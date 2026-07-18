import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient, getStripePriceId, getStripeWebhookSecret } from "@/lib/stripe";
import { syncWorkspaceSubscription } from "@/lib/workspace-billing";

export const runtime = "nodejs";

const subscriptionEvents = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const priceId = getStripePriceId();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !priceId || !webhookSecret || !signature) {
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

  const result = await syncWorkspaceSubscription(event.data.object as Stripe.Subscription, event.created, priceId);

  if (!result.ok && result.code === "database") {
    return NextResponse.json({ error: "Databasen kunde inte uppdateras." }, { status: 500 });
  }

  return NextResponse.json({ received: true, applied: result.ok });
}
