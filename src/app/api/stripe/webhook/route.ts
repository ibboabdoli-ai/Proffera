import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeCheckoutPlanForPriceId, getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { isStripeEventModeAllowed } from "@/lib/stripe-runtime-config";
import { syncWorkspaceSubscription, syncCancelledWorkspaceSubscription } from "@/lib/workspace-billing";
import { applyServiceJobCheckoutCompleted } from "@/lib/workspace-service-job-payments";
import { applyFullSubscriptionRefund } from "@/lib/workspace-subscription-refund";

export const runtime = "nodejs";

const subscriptionEvents = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !webhookSecret || !signature) return NextResponse.json({ error: "Webhook är inte konfigurerad." }, { status: 503 });

  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhookSecret); }
  catch (error) { console.error("Stripe webhook signature verification failed", error); return NextResponse.json({ error: "Ogiltig signatur." }, { status: 400 }); }

  if (!isStripeEventModeAllowed(event.livemode)) {
    console.error("Stripe webhook mode does not match the deployment environment", {
      livemode: event.livemode,
      vercelEnv: process.env.VERCEL_ENV ?? "local",
    });
    return NextResponse.json({ error: "Stripe-läget matchar inte miljön." }, { status: 400 });
  }

  if (event.type === "charge.refunded" || event.type === "refund.created" || event.type === "refund.updated") {
    try {
      let charge: Stripe.Charge;
      if (event.type === "charge.refunded") {
        charge = event.data.object as Stripe.Charge;
      } else {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status !== "succeeded") return NextResponse.json({ received: true, applied: false });
        const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
        if (!chargeId) return NextResponse.json({ received: true, applied: false });
        charge = await stripe.charges.retrieve(chargeId);
      }
      const result = await applyFullSubscriptionRefund(stripe, charge, event.created);
      if (!result.ok) return NextResponse.json({ error: "Återbetalningen kunde inte synkroniseras." }, { status: 500 });
      return NextResponse.json({ received: true, applied: result.applied });
    } catch (error) {
      console.error("Failed to reconcile a fully refunded subscription", error);
      return NextResponse.json({ error: "Återbetalningen kunde inte hanteras." }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.completed") {
    try {
      const applied = await applyServiceJobCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return NextResponse.json({ received: true, applied });
    } catch (error) {
      console.error("Failed to apply service job payment", error);
      return NextResponse.json({ error: "Kundbetalningen kunde inte sparas." }, { status: 500 });
    }
  }

  if (!subscriptionEvents.has(event.type)) return NextResponse.json({ received: true });

  const eventSubscription = event.data.object as Stripe.Subscription;
  let subscription: Stripe.Subscription;
  try { subscription = await stripe.subscriptions.retrieve(eventSubscription.id, {
      expand: ["latest_invoice", "discounts"],
    }); }
  catch (error) { console.error("Failed to retrieve current Stripe subscription state", error); return NextResponse.json({ error: "Stripe-abonnemanget kunde inte läsas." }, { status: 502 }); }

  const priceId = subscription.items.data[0]?.price.id ?? "";
  if (subscription.status === "canceled") {
    // A retired Stripe Price must still revoke access when the persisted
    // subscription binding matches the exact Workspace and Customer.
    const result = await syncCancelledWorkspaceSubscription(subscription, event.created, priceId, stripe);
    if (!result.ok && result.code === "database") {
      return NextResponse.json({ error: "Databasen kunde inte uppdateras." }, { status: 500 });
    }
    return NextResponse.json({ received: true, applied: result.ok });
  }
  const planKey = getStripeCheckoutPlanForPriceId(priceId);
  if (!planKey) return NextResponse.json({ received: true, applied: false });
  const result = await syncWorkspaceSubscription(subscription, event.created, planKey, priceId);
  if (!result.ok && result.code === "database") return NextResponse.json({ error: "Databasen kunde inte uppdateras." }, { status: 500 });
  return NextResponse.json({ received: true, applied: result.ok });
}
