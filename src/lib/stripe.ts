import "server-only";

import Stripe from "stripe";

import {
  checkoutPlanDefinitions,
  checkoutPlanKeys,
  type CheckoutPlanKey,
  type CheckoutPlanOption,
} from "@/lib/billing-plans";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) return null;

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 10_000,
    });
  }

  return stripeClient;
}

export function getStripePriceId() {
  return process.env.STRIPE_PRICE_ID?.trim() || null;
}

export function getStripePriceIdForPlan(planKey: CheckoutPlanKey) {
  if (planKey === "starter") {
    return process.env.STRIPE_PRICE_STARTER?.trim() || null;
  }

  return process.env.STRIPE_PRICE_PROFESSIONAL?.trim() || getStripePriceId();
}

export function getStripeCheckoutPlanOptions(): CheckoutPlanOption[] {
  return checkoutPlanKeys.map((planKey) => ({
    ...checkoutPlanDefinitions[planKey],
    configured: Boolean(getStripePriceIdForPlan(planKey)),
  }));
}

export function getStripeCheckoutPlanForPriceId(priceId: string) {
  return checkoutPlanKeys.find((planKey) => getStripePriceIdForPlan(planKey) === priceId) ?? null;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function isStripeTestMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") ?? false;
}

export function isStripeCheckoutConfigured() {
  return Boolean(getStripeClient() && getStripeCheckoutPlanOptions().some((plan) => plan.configured));
}
