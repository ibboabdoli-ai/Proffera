import type { Metadata } from "next";

import { MarketingHome } from "@/components/marketing/marketing-home";

export const metadata: Metadata = {
  title: {
    absolute: "Proffera – Kundflöde, bokning och CRM för tjänsteföretag",
  },
  description:
    "Visa tjänster, ta emot bokningar och offertförfrågningar och hantera kund, uppdrag och uppföljning i Proffera.",
};

export default function HomePage() {
  return <MarketingHome locale="sv" />;
}
