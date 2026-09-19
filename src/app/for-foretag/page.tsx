import { BusinessHome } from "@/components/marketplace/business-home";
import { createSwedishMetadata } from "@/lib/english-metadata";

export const metadata = createSwedishMetadata({
  title: "Proffera för företag – Bokning, leads, CRM och uppdrag",
  description:
    "Få kunder från Profferas marknadsplats och hantera tjänster, bokningar, offerter, CRM och uppdrag i samma arbetsyta.",
  swedishPath: "/for-foretag",
  englishPath: "/en/for-business",
});

export default function ForBusinessPage() {
  return <BusinessHome locale="sv" />;
}
