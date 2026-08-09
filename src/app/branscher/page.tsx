import type { Metadata } from "next";

import { MarketingIndustries } from "@/components/marketing/marketing-industries";

export const metadata: Metadata = {
  title: {
    absolute: "Branscher – Proffera för tjänsteföretag",
  },
  description:
    "Proffera passar tjänsteföretag som behöver onlinebokning, offertförfrågningar, kund-CRM, uppdrag och uppföljning – från städning och salong till teknisk service.",
};

export default function IndustriesPage() {
  return <MarketingIndustries locale="sv" />;
}
