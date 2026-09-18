import type { Metadata } from "next";

import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { getCheckoutPlanPriceLabel } from "@/lib/billing-plans";

export const metadata: Metadata = {
  title: {
    absolute: `Priser – Proffera från ${getCheckoutPlanPriceLabel("starter", "SEK", "sv")}`,
  },
  description:
    "Jämför Starter, Professional och Enterprise för onlinebokning, CRM, företagssida, offerter, omdömen och analys. Prova Starter eller Professional gratis i 14 dagar.",
};

export default function PricingPage() {
  return <MarketingPricing locale="sv" />;
}
