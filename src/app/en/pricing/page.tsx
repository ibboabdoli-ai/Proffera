import { MarketingPricing } from "@/components/marketing/marketing-pricing";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Pricing – Proffera from SEK 299/month",
  description: "Compare Starter, Professional and Business for online booking, CRM, business page, quotes, reviews and analytics. Try Starter or Professional free for 14 days.",
  englishPath: "/en/pricing",
  swedishPath: "/priser",
});

export default function EnglishPricingPage() {
  return <MarketingPricing locale="en" />;
}
