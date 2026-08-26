import "server-only";

import { unstable_cache } from "next/cache";

import { listDirectorySeoLandings } from "@/lib/company-directory-landing-seo";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import { listPublishedDirectorySitemapEntries } from "@/lib/company-directory-seo";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

const LOCATION_SUGGESTIONS_REVALIDATE_SECONDS = 30 * 60;
const SITEMAP_REVALIDATE_SECONDS = 15 * 60;

const readCachedPublishedDirectoryLocationSuggestions = unstable_cache(
  async (limit: number) => getPublishedDirectoryLocationSuggestions(limit),
  ["public-directory-location-suggestions-v2"],
  { revalidate: LOCATION_SUGGESTIONS_REVALIDATE_SECONDS },
);

export async function getCachedPublishedDirectoryLocationSuggestions(limit = 24) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 24)));
  return readCachedPublishedDirectoryLocationSuggestions(safeLimit);
}

const readCachedPlatformSitemapData = unstable_cache(
  async () => {
    const [publicBusinessEntries, directoryEntries, directoryLandings] = await Promise.all([
      listPublicBusinessSitemapEntries(),
      listPublishedDirectorySitemapEntries(),
      listDirectorySeoLandings(),
    ]);

    return {
      publicBusinessEntries,
      directoryEntries: directoryEntries.map((entry) => ({
        slug: entry.slug,
        lastModified: entry.lastModified.toISOString(),
      })),
      directoryLandings,
    };
  },
  ["platform-sitemap-data-v2"],
  { revalidate: SITEMAP_REVALIDATE_SECONDS },
);

export async function getCachedPlatformSitemapData() {
  return readCachedPlatformSitemapData();
}
