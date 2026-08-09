import { MarketingDemo } from "@/components/marketing/marketing-demo";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Demo – See Proffera's customer workflow",
  description: "See how Proffera connects a business page, booking, quote requests, CRM, jobs, reviews and analytics in a demo adapted to your customer workflow.",
  englishPath: "/en/demo",
  swedishPath: "/demo",
});

export default function EnglishDemoPage() {
  return <MarketingDemo locale="en" />;
}
