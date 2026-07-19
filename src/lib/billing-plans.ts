export const checkoutPlanKeys = ["starter", "professional"] as const;

export type CheckoutPlanKey = (typeof checkoutPlanKeys)[number];

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

export function isCheckoutPlanKey(value: unknown): value is CheckoutPlanKey {
  return typeof value === "string" && checkoutPlanKeys.includes(value as CheckoutPlanKey);
}
