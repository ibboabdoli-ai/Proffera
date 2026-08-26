import "server-only";

import { unstable_cache } from "next/cache";

import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";

const LOCATION_SUGGESTIONS_REVALIDATE_SECONDS = 30 * 60;

const readCachedPublishedDirectoryLocationSuggestions = unstable_cache(
  async (limit: number) => getPublishedDirectoryLocationSuggestions(limit),
  ["public-directory-location-suggestions-v3"],
  { revalidate: LOCATION_SUGGESTIONS_REVALIDATE_SECONDS },
);

export async function getCachedPublishedDirectoryLocationSuggestions(limit = 24) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 24)));
  return readCachedPublishedDirectoryLocationSuggestions(safeLimit);
}
