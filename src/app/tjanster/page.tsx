import type { Metadata } from "next";

import { MarketingFeatures } from "@/components/marketing/marketing-features";

export const metadata: Metadata = {
  title: {
    absolute: "Funktioner – Företagssida, bokning, CRM och offerter | Proffera",
  },
  description:
    "Se hur Proffera kopplar ihop företagssida, onlinebokning, offertförfrågningar, kund-CRM, uppdrag, omdömen och analys i ett arbetsflöde.",
};

export default function ServicesPage() {
  return <MarketingFeatures locale="sv" />;
}
