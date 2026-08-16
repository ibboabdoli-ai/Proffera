import "server-only";

import Stripe from "stripe";

import {
  checkoutPlanDefinitions,
  checkoutPlanKeys,
  getCheckoutPlanDescription,
  getCheckoutPlanPriceLabel,
  type CheckoutPlanKey,
  type CheckoutPlanLocale,
  type CheckoutPlanOption,
} from "@/lib/billing-plans";
import type { WorkspaceBillingCurrency } from "@/lib/workspace-market";

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

export function getStripeCheckoutPlanOptions(
  billingCurrency: WorkspaceBillingCurrency = "SEK",
  locale: CheckoutPlanLocale = "sv",
): CheckoutPlanOption[] {
  return checkoutPlanKeys.map((planKey) => ({
    ...checkoutPlanDefinitions[planKey],
    priceLabel: getCheckoutPlanPriceLabel(planKey, billingCurrency, locale),
    description: getCheckoutPlanDescription(planKey, locale),
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

/**
 * Stripe can localise a SEK subscription price at hosted Checkout without us
 * inventing EUR/GBP amounts in code. It remains opt-in until the account's
 * Adaptive Pricing configuration has been verified in Stripe.
 */
export function isStripeAdaptivePricingEnabled() {
  return process.env.STRIPE_ADAPTIVE_PRICING_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Tax must stay disabled until Proffera has configured the relevant Stripe
 * Tax registrations. A country selector alone is never enough to collect VAT.
 */
export function isStripeTaxEnabled() {
  return process.env.STRIPE_TAX_ENABLED?.trim().toLowerCase() === "true";
}

export function isStripeCheckoutConfigured() {
  return Boolean(getStripeClient() && getStripeCheckoutPlanOptions().some((plan) => plan.configured));
}
