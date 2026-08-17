import { MarketplaceHome } from "@/components/marketplace/marketplace-home";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Find businesses, book appointments or request quotes",
  description: "Search by service and location, find verified business profiles and book, request a quote or view the business in Proffera.",
  englishPath: "/en",
  swedishPath: "/",
});

export default function EnglishHomePage() {
  return <MarketplaceHome locale="en" />;
}
