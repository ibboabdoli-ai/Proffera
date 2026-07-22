import { NextResponse } from "next/server";

import { isCheckoutPlanKey } from "@/lib/billing-plans";
import { getSql } from "@/lib/db/server";
import { getStripeClient, getStripePriceIdForPlan } from "@/lib/stripe";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return jsonError("Ogiltig begäran.", 403);
  }

  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceMembers(access)) {
    return jsonError("Endast arbetsytans Owner kan starta ett abonnemang.", 403);
  }

  const requestBody = await request.json().catch(() => null) as { planKey?: unknown } | null;
  const planKey = requestBody?.planKey;

  if (!isCheckoutPlanKey(planKey)) {
    return jsonError("Välj en tillgänglig plan.", 400);
  }

  const sql = getSql();
  const stripe = getStripeClient();
  const priceId = getStripePriceIdForPlan(planKey);

  if (!sql || !stripe || !priceId) {
    return jsonError("Betalningen är inte färdigkonfigurerad.", 503);
  }

  try {
    const rows = await sql`
      select
        stripe_customer_id,
        stripe_checkout_session_id,
        stripe_subscription_id,
        stripe_price_id,
        status
      from workspace_billing_subscriptions
      where workspace_id = ${access.workspaceId}::uuid
      limit 1
    `;
    const existing = rows[0];
    const existingStatus = existing?.status ? String(existing.status) : "";

    const existingSessionId = existingStatus !== "cancelled" && existing?.stripe_checkout_session_id
      ? String(existing.stripe_checkout_session_id)
      : "";

    if (existingSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);

      if (existingSession.status === "open" && existingSession.url) {
        if (String(existing?.stripe_price_id ?? "") === priceId) {
          return NextResponse.json({ url: existingSession.url }, { headers: { "Cache-Control": "no-store" } });
        }

        // A previous open session for another plan can still be completed after
        // a replacement checkout is created. Expire it first so one workspace
        // cannot create two concurrent subscriptions.
        await stripe.checkout.sessions.expire(existingSessionId);
      }

      if (existingSession.status === "complete") {
        return jsonError("Betalningen är klar och väntar på bekräftelse från Stripe.", 409);
      }
    }

    if (existing?.stripe_subscription_id && existingStatus !== "cancelled") {
      return jsonError("Arbetsytan har redan ett abonnemang. Hantera betalningen via Stripe-portalen.", 409);
    }

    const customerId = existing?.stripe_customer_id ? String(existing.stripe_customer_id) : undefined;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      client_reference_id: access.workspaceId,
      metadata: {
        workspace_id: access.workspaceId,
        workspace_owner_id: access.userId,
        plan_key: planKey,
      },
      subscription_data: {
        metadata: {
          workspace_id: access.workspaceId,
          workspace_owner_id: access.userId,
          plan_key: planKey,
        },
      },
      success_url: `${requestUrl.origin}/dashboard/installningar?billing=success`,
      cancel_url: `${requestUrl.origin}/dashboard/installningar?billing=cancelled`,
    });

    if (!checkoutSession.url) {
      return jsonError("Stripe kunde inte skapa betalningssidan.", 502);
    }

    await sql`
      insert into workspace_billing_subscriptions (
        id, workspace_id, stripe_customer_id, stripe_checkout_session_id, stripe_price_id, status, created_at, updated_at
      )
      values (
        gen_random_uuid(),
        ${access.workspaceId}::uuid,
        ${customerId ?? null},
        ${checkoutSession.id},
        ${priceId},
        'pending',
        now(),
        now()
      )
      on conflict (workspace_id)
      do update set
        stripe_checkout_session_id = excluded.stripe_checkout_session_id,
        stripe_price_id = excluded.stripe_price_id,
        status = 'pending',
        updated_at = now()
    `;

    return NextResponse.json({ url: checkoutSession.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session", error);
    return jsonError("Betalningssidan kunde inte öppnas. Försök igen.", 500);
  }
}
