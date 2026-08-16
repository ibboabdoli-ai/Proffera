import { MarketingHome } from "@/components/marketing/marketing-home-v2";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Customer workflow, booking and CRM for service businesses",
  description: "Show services, receive bookings and quote requests, and manage customers, jobs and follow-up in Proffera.",
  englishPath: "/en",
  swedishPath: "/",
});

export default function EnglishHomePage() {
  return <MarketingHome locale="en" />;
}
