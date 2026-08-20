import type { CheckoutPlanKey } from "@/lib/billing-plans";

function trimmed(value: string | undefined) {
  return value?.trim() || null;
}

function stripeKeyMode(value: string | null) {
  if (!value) return null;
  if (value.startsWith("sk_test_") || value.startsWith("rk_test_")) return "test" as const;
  if (value.startsWith("sk_live_") || value.startsWith("rk_live_")) return "live" as const;
  return null;
}

function webhookSecret(value: string | undefined) {
  const secret = trimmed(value);
  return secret?.startsWith("whsec_") ? secret : null;
}

export function isVercelPreview(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL_ENV === "preview";
}

export function isVercelProduction(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL_ENV === "production";
}

export function resolveStripeSecretKey(env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreview(env)) {
    const previewKey = trimmed(env.PROFFERA_PREVIEW_STRIPE_SECRET_KEY);
    return stripeKeyMode(previewKey) === "test" ? previewKey : null;
  }

  const productionKey = trimmed(env.STRIPE_SECRET_KEY);
  if (isVercelProduction(env)) {
    return stripeKeyMode(productionKey) === "live" ? productionKey : null;
  }

  return productionKey;
}

export function resolveStripeWebhookSecret(env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreview(env)) {
    return webhookSecret(env.PROFFERA_PREVIEW_STRIPE_WEBHOOK_SECRET);
  }

  return webhookSecret(env.STRIPE_WEBHOOK_SECRET);
}

export function resolveStripePriceIdForPlan(
  planKey: CheckoutPlanKey,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (isVercelPreview(env)) {
    return planKey === "starter"
      ? trimmed(env.PROFFERA_PREVIEW_STRIPE_PRICE_STARTER)
      : trimmed(env.PROFFERA_PREVIEW_STRIPE_PRICE_PROFESSIONAL);
  }

  if (planKey === "starter") {
    return trimmed(env.STRIPE_PRICE_STARTER);
  }

  return trimmed(env.STRIPE_PRICE_PROFESSIONAL) ?? trimmed(env.STRIPE_PRICE_ID);
}

export function isResolvedStripeTestMode(env: NodeJS.ProcessEnv = process.env) {
  return stripeKeyMode(resolveStripeSecretKey(env)) === "test";
}

export function isStripeEventModeAllowed(livemode: boolean, env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreview(env)) {
    return !livemode && stripeKeyMode(resolveStripeSecretKey(env)) === "test";
  }
  if (isVercelProduction(env)) {
    return livemode && stripeKeyMode(resolveStripeSecretKey(env)) === "live";
  }
  return true;
}
