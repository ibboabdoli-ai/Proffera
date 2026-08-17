import { describe, expect, it } from "vitest";

import {
  isResolvedStripeTestMode,
  resolveStripePriceIdForPlan,
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
} from "@/lib/stripe-runtime-config";

describe("Stripe runtime configuration", () => {
  it("fails closed in Preview instead of falling back to Production Stripe values", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      STRIPE_SECRET_KEY: "sk_live_prod",
      STRIPE_WEBHOOK_SECRET: "whsec_prod",
      STRIPE_PRICE_STARTER: "price_prod_starter",
      STRIPE_PRICE_PROFESSIONAL: "price_prod_professional",
    };

    expect(resolveStripeSecretKey(env)).toBeNull();
    expect(resolveStripeWebhookSecret(env)).toBeNull();
    expect(resolveStripePriceIdForPlan("starter", env)).toBeNull();
    expect(resolveStripePriceIdForPlan("professional", env)).toBeNull();
    expect(isResolvedStripeTestMode(env)).toBe(false);
  });

  it("accepts only a dedicated test secret and dedicated prices in Preview", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      PROFFERA_PREVIEW_STRIPE_SECRET_KEY: "sk_test_preview",
      PROFFERA_PREVIEW_STRIPE_WEBHOOK_SECRET: "whsec_preview",
      PROFFERA_PREVIEW_STRIPE_PRICE_STARTER: "price_preview_starter",
      PROFFERA_PREVIEW_STRIPE_PRICE_PROFESSIONAL: "price_preview_professional",
    };

    expect(resolveStripeSecretKey(env)).toBe("sk_test_preview");
    expect(resolveStripeWebhookSecret(env)).toBe("whsec_preview");
    expect(resolveStripePriceIdForPlan("starter", env)).toBe("price_preview_starter");
    expect(resolveStripePriceIdForPlan("professional", env)).toBe("price_preview_professional");
    expect(isResolvedStripeTestMode(env)).toBe(true);
  });

  it("rejects a live secret even when it is placed in the Preview-specific variable", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      PROFFERA_PREVIEW_STRIPE_SECRET_KEY: "sk_live_not_allowed",
    };

    expect(resolveStripeSecretKey(env)).toBeNull();
    expect(isResolvedStripeTestMode(env)).toBe(false);
  });

  it("keeps Production resolution unchanged", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_prod",
      STRIPE_WEBHOOK_SECRET: "whsec_prod",
      STRIPE_PRICE_STARTER: "price_prod_starter",
      STRIPE_PRICE_PROFESSIONAL: "price_prod_professional",
    };

    expect(resolveStripeSecretKey(env)).toBe("sk_live_prod");
    expect(resolveStripeWebhookSecret(env)).toBe("whsec_prod");
    expect(resolveStripePriceIdForPlan("starter", env)).toBe("price_prod_starter");
    expect(resolveStripePriceIdForPlan("professional", env)).toBe("price_prod_professional");
  });
});
