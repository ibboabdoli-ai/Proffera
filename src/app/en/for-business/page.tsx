import { BusinessHome } from "@/components/marketplace/business-home";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Proffera for businesses – Booking, leads, CRM and jobs",
  description: "Win customers from the Proffera marketplace and manage services, bookings, quotes, CRM and jobs in the same workspace.",
  englishPath: "/en/for-business",
  swedishPath: "/for-foretag",
});

export default function EnglishForBusinessPage() {
  return <BusinessHome locale="en" />;
}
