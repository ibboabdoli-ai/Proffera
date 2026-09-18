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

/**
 * Canonical Proffera recurring launch prices in SEK.
 *
 * Product copy and Checkout labels must derive from this map so public pricing
 * cannot drift between marketing, signup and billing surfaces. Stripe Price
 * objects remain provider configuration and must be reconciled separately
 * before a pricing change is released to Production.
 */
export const checkoutPlanMonthlyPricesSek = {
  starter: 299,
  professional: 599,
} as const satisfies Record<CheckoutPlanKey, number>;

function getSekMonthlyPriceLabel(planKey: CheckoutPlanKey, locale: CheckoutPlanLocale) {
  const amount = checkoutPlanMonthlyPricesSek[planKey];
  return locale === "sv" ? `${amount} kr/mån` : `SEK ${amount}/month`;
}

export const checkoutPlanDefinitions: Record<CheckoutPlanKey, Omit<CheckoutPlanOption, "configured">> = {
  starter: {
    key: "starter",
    name: "Starter",
    priceLabel: getSekMonthlyPriceLabel("starter", "sv"),
    description: "Onlinebokning, leadhantering, Kund-CRM, kundportal och bokningspåminnelser.",
  },
  professional: {
    key: "professional",
    name: "Professional",
    priceLabel: getSekMonthlyPriceLabel("professional", "sv"),
    description: "Allt i Starter samt företagssida, offerter, galleri, verifierade omdömen, analys och flera medarbetare.",
  },
};

const checkoutPlanDescriptions: Record<CheckoutPlanKey, Record<CheckoutPlanLocale, string>> = {
  starter: {
    sv: checkoutPlanDefinitions.starter.description,
    en: "Online booking, lead management, Customer CRM, customer portal and booking reminders.",
  },
  professional: {
    sv: checkoutPlanDefinitions.professional.description,
    en: "Everything in Starter plus a business page, quotes, gallery, verified reviews, analytics and multiple staff.",
  },
};

export function getCheckoutPlanDescription(planKey: CheckoutPlanKey, locale: CheckoutPlanLocale) {
  return checkoutPlanDescriptions[planKey][locale];
}

/**
 * The recurring Stripe Prices are SEK-denominated. Checkout remains the
 * authority for the final currency and amount, including any Stripe-hosted
 * localisation/adaptive pricing that may be enabled separately.
 * Keep these labels descriptive; never invent unsupported Price currencies.
 */
const checkoutPlanPriceLabels: Record<
  CheckoutPlanKey,
  Record<WorkspaceBillingCurrency, Record<CheckoutPlanLocale, string>>
> = {
  starter: {
    SEK: {
      sv: getSekMonthlyPriceLabel("starter", "sv"),
      en: getSekMonthlyPriceLabel("starter", "en"),
    },
    EUR: {
      sv: `${getSekMonthlyPriceLabel("starter", "sv")} · slutlig valuta visas i kassan`,
      en: `${getSekMonthlyPriceLabel("starter", "en")} · final currency shown at checkout`,
    },
    GBP: {
      sv: `${getSekMonthlyPriceLabel("starter", "sv")} · slutlig valuta visas i kassan`,
      en: `${getSekMonthlyPriceLabel("starter", "en")} · final currency shown at checkout`,
    },
  },
  professional: {
    SEK: {
      sv: getSekMonthlyPriceLabel("professional", "sv"),
      en: getSekMonthlyPriceLabel("professional", "en"),
    },
    EUR: {
      sv: `${getSekMonthlyPriceLabel("professional", "sv")} · slutlig valuta visas i kassan`,
      en: `${getSekMonthlyPriceLabel("professional", "en")} · final currency shown at checkout`,
    },
    GBP: {
      sv: `${getSekMonthlyPriceLabel("professional", "sv")} · slutlig valuta visas i kassan`,
      en: `${getSekMonthlyPriceLabel("professional", "en")} · final currency shown at checkout`,
    },
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
