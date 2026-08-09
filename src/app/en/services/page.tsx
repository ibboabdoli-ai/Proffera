import { MarketingFeatures } from "@/components/marketing/marketing-features";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Features – business page, booking, CRM and quotes",
  description: "See how Proffera connects a public business page, online booking, quote requests, customer CRM, jobs, reviews and analytics in one workflow.",
  englishPath: "/en/services",
  swedishPath: "/tjanster",
});

export default function EnglishServicesPage() {
  return <MarketingFeatures locale="en" />;
}
