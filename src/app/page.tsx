import { MarketplaceHome } from "@/components/marketplace/marketplace-home";
import { createSwedishMetadata } from "@/lib/english-metadata";

export const metadata = createSwedishMetadata({
  title: "Proffera – Hitta företag, boka tid eller få offerter",
  description:
    "Sök efter tjänst och ort, hitta verifierade företagsprofiler och boka tid, begär offert eller se företaget i Proffera.",
  swedishPath: "/",
  englishPath: "/en",
});

export default function HomePage() {
  return <MarketplaceHome locale="sv" />;
}
