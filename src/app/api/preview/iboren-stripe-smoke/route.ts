import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import {
  getStripeClient,
  getStripePriceIdForPlan,
  isStripeTestMode,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, reason: "not-preview" }, { status: 404 });
  }

  const sql = getSql();
  const stripe = getStripeClient();
  if (!sql || !stripe || !isStripeTestMode()) {
    return NextResponse.json({ ok: false, reason: "preview-test-mode-not-configured" }, { status: 503 });
  }

  const rows = await sql`
    select w.id, w.name
    from workspaces w
    join workspace_memberships wm on wm.workspace_id = w.id
    where w.slug = 'iboren-preview-test'
      and wm.role = 'owner'
    limit 1
  `;
  const workspaceId = rows[0]?.id ? String(rows[0].id) : null;
  if (!workspaceId) {
    return NextResponse.json({ ok: false, reason: "iboren-workspace-not-found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const results: Record<string, unknown> = {};

  for (const planKey of ["starter", "professional"] as const) {
    const priceId = getStripePriceIdForPlan(planKey);
    if (!priceId) {
      results[planKey] = { ok: false, reason: "price-not-configured" };
      continue;
    }

    const price = await stripe.prices.retrieve(priceId);
    if (price.livemode) {
      return NextResponse.json({ ok: false, reason: "refused-live-price", planKey }, { status: 409 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: workspaceId,
      metadata: {
        workspace_id: workspaceId,
        plan_key: planKey,
        smoke_test: "iboren-preview",
      },
      subscription_data: {
        metadata: {
          workspace_id: workspaceId,
          plan_key: planKey,
          smoke_test: "iboren-preview",
        },
      },
      success_url: `${origin}/dashboard/installningar?billing=success&smoke=1`,
      cancel_url: `${origin}/dashboard/installningar?billing=cancelled&smoke=1`,
    });

    const isTestSession = session.id.startsWith("cs_test_") && session.livemode === false;
    results[planKey] = {
      ok: isTestSession,
      sessionPrefix: session.id.slice(0, 8),
      livemode: session.livemode,
      currency: price.currency,
      unitAmount: price.unit_amount,
      status: session.status,
      hasUrl: Boolean(session.url),
    };
  }

  const starterOk = (results.starter as { ok?: boolean } | undefined)?.ok === true;
  const professionalOk = (results.professional as { ok?: boolean } | undefined)?.ok === true;

  return NextResponse.json(
    {
      ok: starterOk && professionalOk,
      environment: "preview",
      stripeTestMode: true,
      workspace: "Iboren",
      results,
    },
    {
      status: starterOk && professionalOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
