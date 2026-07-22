import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeCheckoutPlanForPriceId, getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { syncWorkspaceSubscription } from "@/lib/workspace-billing";

export const runtime = "nodejs";

const subscriptionEvents = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook är inte konfigurerad." }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Ogiltig signatur." }, { status: 400 });
  }

  if (!subscriptionEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const eventSubscription = event.data.object as Stripe.Subscription;
  let subscription: Stripe.Subscription;

  try {
    // Stripe can deliver subscription events out of order. Always synchronise
    // from Stripe's current subscription snapshot rather than applying the
    // event payload, which can already be stale when it reaches this endpoint.
    subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
  } catch (error) {
    console.error("Failed to retrieve current Stripe subscription state", error);
    return NextResponse.json({ error: "Stripe-abonnemanget kunde inte läsas." }, { status: 502 });
  }

  const priceId = subscription.items.data[0]?.price.id ?? "";
  const planKey = getStripeCheckoutPlanForPriceId(priceId);

  if (!planKey) {
    return NextResponse.json({ received: true, applied: false });
  }

  const result = await syncWorkspaceSubscription(subscription, event.created, planKey, priceId);

  if (!result.ok && result.code === "database") {
    return NextResponse.json({ error: "Databasen kunde inte uppdateras." }, { status: 500 });
  }

  return NextResponse.json({ received: true, applied: result.ok });
}
