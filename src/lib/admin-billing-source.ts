export const BILLING_SOURCE_OF_TRUTH = {
  stripe: {
    label: "Stripe webhook snapshot",
    fields: [
      "subscription status",
      "current period start and end",
      "cancel at period end",
      "price-to-plan mapping",
    ],
  },
  internal: {
    label: "Proffera database",
    fields: ["eligible non-Stripe trial end date"],
  },
} as const;

export const BILLING_READ_ONLY_OPERATIONS = [
  "plan change",
  "subscription status change",
  "cancel subscription",
  "refund payment",
] as const;

export const BILLING_PRIVATE_DATA = [
  "Stripe customer ID",
  "Stripe subscription ID",
  "Stripe price ID",
  "payment method",
  "card data",
] as const;
