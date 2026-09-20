import "server-only";

import { unstable_cache } from "next/cache";

import { searchPublishedBusinessProfiles } from "@/lib/business-profile-search";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

// Location suggestions are public, low-volatility labels. Keep them warm for a
// day so bare Directory landing requests do not periodically wake Neon. Actual
// Search/Nearby results remain live and outside this cache.
const LOCATION_SUGGESTIONS_REVALIDATE_SECONDS = 24 * 60 * 60;
const MARKETPLACE_HOME_COMPANIES_REVALIDATE_SECONDS = 30 * 60;
const PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS = 30 * 60;

const readCachedPublishedDirectoryLocationSuggestions = unstable_cache(
  async (limit: number) => getPublishedDirectoryLocationSuggestions(limit),
  ["public-directory-location-suggestions-v3"],
  { revalidate: LOCATION_SUGGESTIONS_REVALIDATE_SECONDS },
);

const readCachedMarketplaceHomeCompanies = unstable_cache(
  async (limit: number) => searchPublishedBusinessProfiles({ limit, sort: "recommended" }),
  ["marketplace-home-companies-v1"],
  { revalidate: MARKETPLACE_HOME_COMPANIES_REVALIDATE_SECONDS },
);

const readCachedPublicBusinessSitemapEntries = unstable_cache(
  async () => listPublicBusinessSitemapEntries(),
  ["platform-public-business-sitemap-v1"],
  { revalidate: PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS },
);

export async function getCachedPublishedDirectoryLocationSuggestions(limit = 24) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const safeLimit = Math.max(1, Math.min(100, Math.floor(normalizedLimit)));
  return readCachedPublishedDirectoryLocationSuggestions(safeLimit);
}

export async function getCachedMarketplaceHomeCompanies(limit = 4) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 4;
  const safeLimit = Math.max(1, Math.min(8, Math.floor(normalizedLimit)));
  return readCachedMarketplaceHomeCompanies(safeLimit);
}

export async function getCachedPublicBusinessSitemapEntries() {
  return readCachedPublicBusinessSitemapEntries();
}
