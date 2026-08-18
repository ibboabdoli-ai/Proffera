import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import {
  getStripeClient,
  getStripePriceIdForPlan,
  getStripeWebhookSecret,
  isStripeTestMode,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const sql = getSql();
  const stripe = getStripeClient();
  const starterPriceId = getStripePriceIdForPlan("starter");
  const professionalPriceId = getStripePriceIdForPlan("professional");

  if (!sql) {
    return NextResponse.json({ ok: false, stage: "database", reason: "preview_database_unavailable" }, { status: 503 });
  }

  if (!stripe || !isStripeTestMode()) {
    return NextResponse.json({ ok: false, stage: "stripe", reason: "preview_stripe_not_test_mode" }, { status: 503 });
  }

  if (!starterPriceId || !professionalPriceId) {
    return NextResponse.json({ ok: false, stage: "stripe", reason: "preview_price_missing" }, { status: 503 });
  }

  const identityRows = await sql`
    select
      current_database() as database_name,
      current_setting('neon.project_id', true) as neon_project_id,
      current_setting('neon.branch_id', true) as neon_branch_id
  `;
  const dbIdentity = identityRows[0] ?? {};

  const origin = new URL(request.url).origin;
  const results = [] as Array<{
    plan: "starter" | "professional";
    priceId: string;
    amount: number | null;
    currency: string;
    priceLivemode: boolean;
    checkoutSessionId: string;
    checkoutLivemode: boolean;
    checkoutStatus: string | null;
    expired: boolean;
  }>;

  for (const plan of ["starter", "professional"] as const) {
    const priceId = plan === "starter" ? starterPriceId : professionalPriceId;
    const price = await stripe.prices.retrieve(priceId);

    if (price.livemode) {
      return NextResponse.json({ ok: false, stage: plan, reason: "live_price_rejected" }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: "iboren-preview-smoke",
      metadata: {
        plan_key: plan,
        smoke_test: "iboren-preview-20260819",
        database_write: "none",
      },
      subscription_data: {
        metadata: {
          plan_key: plan,
          smoke_test: "iboren-preview-20260819",
          database_write: "none",
        },
      },
      success_url: `${origin}/dashboard/installningar?billing=success`,
      cancel_url: `${origin}/dashboard/installningar?billing=cancelled`,
    });

    if (session.livemode || !session.id.startsWith("cs_test_")) {
      return NextResponse.json({ ok: false, stage: plan, reason: "non_test_checkout_rejected" }, { status: 503 });
    }

    const expiredSession = await stripe.checkout.sessions.expire(session.id);

    results.push({
      plan,
      priceId,
      amount: price.unit_amount,
      currency: price.currency,
      priceLivemode: price.livemode,
      checkoutSessionId: session.id,
      checkoutLivemode: session.livemode,
      checkoutStatus: expiredSession.status,
      expired: expiredSession.status === "expired",
    });
  }

  return NextResponse.json({
    ok: true,
    environment: "preview",
    database: {
      name: String(dbIdentity.database_name ?? ""),
      projectId: String(dbIdentity.neon_project_id ?? ""),
      branchId: String(dbIdentity.neon_branch_id ?? ""),
    },
    stripeTestMode: true,
    webhookConfigured: Boolean(getStripeWebhookSecret()),
    databaseWrites: 0,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
