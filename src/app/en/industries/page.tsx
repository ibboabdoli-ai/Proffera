import { MarketingIndustries } from "@/components/marketing/marketing-industries";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Industries – Proffera for service businesses",
  description: "Proffera fits service businesses that need online booking, quote requests, customer CRM, jobs and follow-up – from cleaning and salons to technical service.",
  englishPath: "/en/industries",
  swedishPath: "/branscher",
});

export default function EnglishIndustriesPage() {
  return <MarketingIndustries locale="en" />;
}
