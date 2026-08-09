import type { Metadata } from "next";

import { MarketingDemo } from "@/components/marketing/marketing-demo";

export const metadata: Metadata = {
  title: {
    absolute: "Demo – Se Profferas kundflöde för tjänsteföretag",
  },
  description:
    "Se hur Proffera kopplar ihop företagssida, bokning, offertförfrågningar, CRM, uppdrag, omdömen och analys i en demo anpassad efter ditt kundflöde.",
};

export default function DemoPage() {
  return <MarketingDemo locale="sv" />;
}
