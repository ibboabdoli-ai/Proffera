import type { Metadata } from "next";

import { BusinessHome } from "@/components/marketplace/business-home";

export const metadata: Metadata = {
  title: {
    absolute: "Proffera för företag – Bokning, leads, CRM och uppdrag",
  },
  description:
    "Få kunder från Profferas marknadsplats och hantera tjänster, bokningar, offerter, CRM och uppdrag i samma arbetsyta.",
};

export default function ForBusinessPage() {
  return <BusinessHome locale="sv" />;
}
