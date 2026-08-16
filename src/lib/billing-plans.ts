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
    priceLabel: "199 kr/mån",
    description: "Bokning, kontaktformulär och grundläggande leadlista.",
  },
  professional: {
    key: "professional",
    name: "Professional",
    priceLabel: "599 kr/mån",
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
    SEK: { sv: "199 kr/mån", en: "SEK 199/month" },
    EUR: { sv: "Från 18 €/mån", en: "From €18/month" },
    GBP: { sv: "Från £16/mån", en: "From £16/month" },
  },
  professional: {
    SEK: { sv: "599 kr/mån", en: "SEK 599/month" },
    EUR: { sv: "Från 54 €/mån", en: "From €54/month" },
    GBP: { sv: "Från £47/mån", en: "From £47/month" },
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
