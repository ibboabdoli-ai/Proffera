import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { getCheckoutPlanPriceLabel } from "@/lib/billing-plans";
import { createSwedishMetadata } from "@/lib/english-metadata";

export const metadata = createSwedishMetadata({
  title: `Priser – Proffera från ${getCheckoutPlanPriceLabel("starter", "SEK", "sv")}`,
  description:
    "Jämför Starter, Professional och Enterprise för onlinebokning, CRM, företagssida, offerter, omdömen och analys. Prova Starter eller Professional gratis i 14 dagar.",
  swedishPath: "/priser",
  englishPath: "/en/pricing",
});

export default function PricingPage() {
  return <MarketingPricing locale="sv" />;
}
