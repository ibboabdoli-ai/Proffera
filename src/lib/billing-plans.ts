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
 * The live recurring Stripe Prices are SEK-denominated. Checkout remains the
 * authority for the final currency and amount, including any Stripe-hosted
 * localisation/adaptive pricing that may be enabled separately.
 * Keep these labels descriptive; never invent unsupported live Price currencies.
 */
const checkoutPlanPriceLabels: Record<
  CheckoutPlanKey,
  Record<WorkspaceBillingCurrency, Record<CheckoutPlanLocale, string>>
> = {
  starter: {
    SEK: { sv: "199 kr/mån", en: "SEK 199/month" },
    EUR: { sv: "199 kr/mån · slutlig valuta visas i kassan", en: "SEK 199/month · final currency shown at checkout" },
    GBP: { sv: "199 kr/mån · slutlig valuta visas i kassan", en: "SEK 199/month · final currency shown at checkout" },
  },
  professional: {
    SEK: { sv: "599 kr/mån", en: "SEK 599/month" },
    EUR: { sv: "599 kr/mån · slutlig valuta visas i kassan", en: "SEK 599/month · final currency shown at checkout" },
    GBP: { sv: "599 kr/mån · slutlig valuta visas i kassan", en: "SEK 599/month · final currency shown at checkout" },
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
