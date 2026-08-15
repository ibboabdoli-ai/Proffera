import type { CheckoutPlanKey } from "@/lib/billing-plans";

function trimmed(value: string | undefined) {
  return value?.trim() || null;
}

export function isVercelPreview(env: NodeJS.ProcessEnv = process.env) {
  return env.VERCEL_ENV === "preview";
}

export function resolveStripeSecretKey(env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreview(env)) {
    const previewKey = trimmed(env.PROFFERA_PREVIEW_STRIPE_SECRET_KEY);
    return previewKey?.startsWith("sk_test_") ? previewKey : null;
  }

  return trimmed(env.STRIPE_SECRET_KEY);
}

export function resolveStripeWebhookSecret(env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreview(env)) {
    return trimmed(env.PROFFERA_PREVIEW_STRIPE_WEBHOOK_SECRET);
  }

  return trimmed(env.STRIPE_WEBHOOK_SECRET);
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
  return resolveStripeSecretKey(env)?.startsWith("sk_test_") ?? false;
}
