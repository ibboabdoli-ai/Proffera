import type { Metadata } from "next";

import { MarketplaceHome } from "@/components/marketplace/marketplace-home";

export const metadata: Metadata = {
  title: {
    absolute: "Proffera – Hitta företag, boka tid eller få offerter",
  },
  description:
    "Sök efter tjänst och ort, hitta verifierade företagsprofiler och boka tid, begär offert eller se företaget i Proffera.",
};

export default function HomePage() {
  return <MarketplaceHome locale="sv" />;
}
