import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getSql } from "@/lib/db/server";
import { getStripeClient, getStripePriceIdForPlan } from "@/lib/stripe";
import { syncWorkspaceSubscription } from "@/lib/workspace-billing";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function invoiceUrl(invoice: string | Stripe.Invoice | null) {
  return invoice && typeof invoice !== "string" ? invoice.hosted_invoice_url : null;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return jsonError("Ogiltig begäran.", 403);
  }

  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceMembers(access)) {
    return jsonError("Endast arbetsytans Owner kan uppgradera abonnemanget.", 403);
  }

  const sql = getSql();
  const stripe = getStripeClient();
  const starterPriceId = getStripePriceIdForPlan("starter");
  const professionalPriceId = getStripePriceIdForPlan("professional");

  if (!sql || !stripe || !starterPriceId || !professionalPriceId) {
    return jsonError("Uppgradering är inte färdigkonfigurerad.", 503);
  }

  if (starterPriceId === professionalPriceId) {
    return jsonError("Starter och Professional behöver ha olika Stripe-priser.", 503);
  }

  try {
    const rows = await sql`
      select
        wbs.stripe_subscription_id,
        wbs.status,
        wp.plan_key
      from workspace_billing_subscriptions wbs
      left join workspace_plans wp on wp.id = wbs.workspace_plan_id
      where wbs.workspace_id = ${access.workspaceId}::uuid
      limit 1
    `;
    const billing = rows[0];
    const status = billing?.status ? String(billing.status) : "";
    const planKey = billing?.plan_key ? String(billing.plan_key) : "";
    const subscriptionId = billing?.stripe_subscription_id ? String(billing.stripe_subscription_id) : "";

    if (!subscriptionId || (status !== "active" && status !== "trialing")) {
      return jsonError("Ett aktivt Starter-abonnemang krävs för att uppgradera.", 409);
    }

    if (planKey === "professional") {
      return jsonError("Professional är redan aktivt för arbetsytan.", 409);
    }

    if (planKey !== "starter") {
      return jsonError("Den nuvarande planen kan inte uppgraderas automatiskt.", 409);
    }

    let subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    const subscriptionItem = subscription.items.data[0];

    if (subscription.metadata.workspace_id !== access.workspaceId || !subscriptionItem) {
      return jsonError("Stripe-abonnemanget matchar inte arbetsytan.", 409);
    }

    if (subscriptionItem.price.id !== starterPriceId && subscriptionItem.price.id !== professionalPriceId) {
      return jsonError("Stripe-abonnemanget använder ett okänt pris.", 409);
    }

    if (subscription.pending_update) {
      return NextResponse.json(
        {
          pending: true,
          url: invoiceUrl(subscription.latest_invoice),
          error: "Slutför den befintliga betalningen innan Professional aktiveras.",
        },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (subscriptionItem.price.id === starterPriceId) {
      subscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: subscriptionItem.id, price: professionalPriceId, quantity: subscriptionItem.quantity ?? 1 }],
        metadata: {
          ...subscription.metadata,
          workspace_id: access.workspaceId,
          workspace_owner_id: access.userId,
          plan_key: "professional",
        },
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        expand: ["latest_invoice"],
      });
    }

    if (subscription.pending_update) {
      return NextResponse.json(
        {
          pending: true,
          url: invoiceUrl(subscription.latest_invoice),
          error: "Betalningen behöver slutföras innan Professional aktiveras.",
        },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    const applied = await syncWorkspaceSubscription(
      subscription,
      Math.floor(Date.now() / 1000),
      "professional",
      professionalPriceId,
    );

    return NextResponse.json(
      { upgraded: true, applied: applied.ok },
      { status: applied.ok ? 200 : 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to upgrade Stripe subscription", error);
    return jsonError("Abonnemanget kunde inte uppgraderas. Försök igen.", 500);
  }
}
