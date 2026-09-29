import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { searchPublishedBusinessProfiles } from "@/lib/business-profile-search";
import { PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG } from "@/lib/company-directory-public-cache";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

export { PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG };

export const MARKETPLACE_HOME_COMPANIES_CACHE_TAG = "marketplace-home-companies:v1";
const PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS = 30 * 60;

// Directory location suggestions and Marketplace home companies are
// authority-bound public projections. On Next.js 16.3.3, an unstable_cache
// fill can finish after an earlier tag invalidation and then persist that
// just-computed entry. Per-hit canonical validation closes that race but costs
// the same live read as serving the canonical query directly. Keep these two
// projections live until the runtime cache can bind insertion to an authority
// generation; this is both cheaper than fill+revalidation and fail-closed.
const readCachedPublicBusinessSitemapEntries = unstable_cache(
  async () => listPublicBusinessSitemapEntries(),
  ["platform-public-business-sitemap-v1"],
  { revalidate: PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS },
);

export async function getCachedPublishedDirectoryLocationSuggestions(limit = 24) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const safeLimit = Math.max(1, Math.min(100, Math.floor(normalizedLimit)));
  return getPublishedDirectoryLocationSuggestions(safeLimit);
}

export async function getCachedMarketplaceHomeCompanies(limit = 4) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 4;
  const safeLimit = Math.max(1, Math.min(8, Math.floor(normalizedLimit)));
  return searchPublishedBusinessProfiles({ limit: safeLimit, sort: "recommended" });
}

export async function getCachedPublicBusinessSitemapEntries() {
  return readCachedPublicBusinessSitemapEntries();
}

export function invalidateMarketplaceHomeCompaniesCache() {
  // Kept as the shared mutation hook so callers remain compatible if this
  // projection returns to a safe tagged cache in a later runtime.
  revalidateTag(MARKETPLACE_HOME_COMPANIES_CACHE_TAG, { expire: 0 });
}
