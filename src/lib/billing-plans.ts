import type { WorkspaceBillingCurrency } from "@/lib/workspace-market";

export const checkoutPlanKeys = ["starter", "professional"] as const;

export type CheckoutPlanKey = (typeof checkoutPlanKeys)[number];
export type CheckoutPlanLocale = "sv" | "en";

export type CheckoutPlanOption = {
  key: CheckoutPlanKey;
  name: string;
  priceLabel: string;
  description: string;
  configured: boolean;
};

export const checkoutPlanDefinitions: Record<CheckoutPlanKey, Omit<CheckoutPlanOption, "configured">> = {
  starter: {
    key: "starter",
    name: "Starter",
    priceLabel: "Från 299 kr/mån",
    description: "Bokning, kontaktformulär och grundläggande leadlista.",
  },
  professional: {
    key: "professional",
    name: "Professional",
    priceLabel: "Från 699 kr/mån",
    description: "Allt i Starter samt CRM och en samlad kundöversikt.",
  },
};

/**
 * These labels mirror the live Stripe Price currency options. They are display
 * values only: Stripe Checkout remains the final authority for the charge.
 */
const checkoutPlanPriceLabels: Record<
  CheckoutPlanKey,
  Record<WorkspaceBillingCurrency, Record<CheckoutPlanLocale, string>>
> = {
  starter: {
    SEK: { sv: "Från 299 kr/mån", en: "From SEK 299/month" },
    EUR: { sv: "Från 28 €/mån", en: "From €28/month" },
    GBP: { sv: "Från £24/mån", en: "From £24/month" },
  },
  professional: {
    SEK: { sv: "Från 699 kr/mån", en: "From SEK 699/month" },
    EUR: { sv: "Från 64 €/mån", en: "From €64/month" },
    GBP: { sv: "Från £55/mån", en: "From £55/month" },
  },
};

export function getCheckoutPlanPriceLabel(
  planKey: CheckoutPlanKey,
  currency: WorkspaceBillingCurrency,
  locale: CheckoutPlanLocale,
) {
  return checkoutPlanPriceLabels[planKey][currency][locale];
}

export function isCheckoutPlanKey(value: unknown): value is CheckoutPlanKey {
  return typeof value === "string" && checkoutPlanKeys.includes(value as CheckoutPlanKey);
}
