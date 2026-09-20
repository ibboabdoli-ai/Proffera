import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locationSuggestions: vi.fn(async (limit: number) => [`location-${limit}`]),
  publicBusinessSitemapEntries: vi.fn(async () => [{ workspaceSlug: "example-ab", serviceSlug: null }]),
  marketplaceHomeCompanies: vi.fn(async ({ limit }: { limit: number }) => ({
    results: [{ id: `company-${limit}` }],
    totalCount: 1,
  })),
  getSql: vi.fn(),
  revalidateTag: vi.fn(),
  unstableCache: vi.fn((
    loader: (...args: never[]) => Promise<unknown>,
    _keyParts: string[],
    _options: { revalidate: number; tags?: string[] },
  ) => loader),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, unstable_cache: mocks.unstableCache }));
vi.mock("@/lib/business-profile-search", () => ({
  searchPublishedBusinessProfiles: mocks.marketplaceHomeCompanies,
}));
vi.mock("@/lib/company-directory-public-search", () => ({
  getPublishedDirectoryLocationSuggestions: mocks.locationSuggestions,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-business-seo", () => ({
  listPublicBusinessSitemapEntries: mocks.publicBusinessSitemapEntries,
}));

import {
  getCachedMarketplaceHomeCompanies,
  getCachedPublishedDirectoryLocationSuggestions,
  invalidateMarketplaceHomeCompaniesCache,
  MARKETPLACE_HOME_COMPANIES_CACHE_TAG,
  PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG,
  getCachedPublicBusinessSitemapEntries,
} from "../src/lib/public-read-cache";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

beforeEach(() => {
  mocks.getSql.mockReset();
  mocks.revalidateTag.mockClear();
  mocks.marketplaceHomeCompanies.mockReset().mockImplementation(async ({ limit }: { limit: number }) => ({
    results: [{ id: `company-${limit}` }],
    totalCount: 1,
  }));
});

describe("public read cache contract", () => {
  it("keeps Directory location suggestions for one day while preserving the 30-minute Public Business sitemap cache", async () => {
    expect(mocks.unstableCache).toHaveBeenCalledTimes(3);

    const locationCall = mocks.unstableCache.mock.calls.find(([, keyParts]) => keyParts[0] === "public-directory-location-suggestions-v4");
    expect(locationCall?.[2]).toEqual({
      revalidate: 24 * 60 * 60,
      tags: [PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG],
    });

    const marketplaceCall = mocks.unstableCache.mock.calls.find(([, keyParts]) => keyParts[0] === "marketplace-home-companies-v4");
    expect(marketplaceCall?.[2]).toEqual({
      revalidate: 30 * 60,
      tags: [MARKETPLACE_HOME_COMPANIES_CACHE_TAG],
    });

    const sitemapCall = mocks.unstableCache.mock.calls.find(([, keyParts]) => keyParts[0] === "platform-public-business-sitemap-v1");
    expect(sitemapCall?.[2]).toEqual({ revalidate: 30 * 60 });

    await expect(getCachedPublishedDirectoryLocationSuggestions(999.9)).resolves.toEqual(["location-100"]);
    expect(mocks.locationSuggestions).toHaveBeenLastCalledWith(100);

    await expect(getCachedPublishedDirectoryLocationSuggestions(0)).resolves.toEqual(["location-1"]);
    expect(mocks.locationSuggestions).toHaveBeenLastCalledWith(1);

    await expect(getCachedPublishedDirectoryLocationSuggestions(Number.NaN)).resolves.toEqual(["location-24"]);
    expect(mocks.locationSuggestions).toHaveBeenLastCalledWith(24);

    await expect(getCachedMarketplaceHomeCompanies(99)).resolves.toMatchObject({ results: [{ id: "company-8" }] });
    expect(mocks.marketplaceHomeCompanies).toHaveBeenLastCalledWith({ limit: 8, sort: "recommended" });

    await expect(getCachedPublicBusinessSitemapEntries()).resolves.toEqual([{ workspaceSlug: "example-ab", serviceSlug: null }]);
    expect(mocks.publicBusinessSitemapEntries).toHaveBeenCalledTimes(1);

    invalidateMarketplaceHomeCompaniesCache();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(MARKETPLACE_HOME_COMPANIES_CACHE_TAG, { expire: 0 });
  });

  it("rechecks Marketplace companies once their workplace authority reaches its exact deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T13:00:00.000Z"));
    const profileId = "11111111-1111-4111-8111-111111111111";
    mocks.marketplaceHomeCompanies
      .mockResolvedValueOnce({ results: [{ id: profileId }], totalCount: 1 })
      .mockResolvedValueOnce({ results: [], totalCount: 0 });
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      profile_count: 1,
      juridical_count: 1,
      authority_expires_at: "2026-09-20T13:00:00.000Z",
    }]));

    try {
      await expect(getCachedMarketplaceHomeCompanies(4)).resolves.toMatchObject({ results: [] });
      expect(mocks.marketplaceHomeCompanies).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps generic caches separate while Directory profile caching stays behind its audited boundary", () => {
    const homepage = source("src/components/marketplace/marketplace-home.tsx");
    const directorySearchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const sitemap = source("src/app/sitemap.ts");
    const requestCache = source("src/lib/company-directory-public-data.ts");
    const profileResolver = source("src/lib/business-profile-public.ts");
    const directoryCacheBoundary = source("src/lib/company-directory-public-cache.ts");
    const fullRevalidation = source("src/lib/company-directory-full-revalidation.ts");
    const publishedRevalidation = source("src/lib/company-directory-published-revalidation.ts");
    const revalidationRoute = source("src/app/api/cron/company-directory-revalidation/route.ts");

    expect(homepage).toContain("getCachedPublishedDirectoryLocationSuggestions(24)");
    expect(homepage).toContain("getCachedMarketplaceHomeCompanies(4)");
    expect(directorySearchPage).toContain("getCachedPublishedDirectoryLocationSuggestions(60)");
    expect(directorySearchPage).toContain("searchPublishedBusinessProfiles({");
    expect(sitemap).toContain("getCachedPublicBusinessSitemapEntries()");
    expect(sitemap).not.toContain("listPublishedDirectorySitemapEntries()");
    expect(sitemap).not.toContain("listDirectorySeoLandings()");

    // Persistent profile caching remains isolated behind the audited Directory
    // boundary; only its fallback TTL is lengthened, not the cache eligibility.
    expect(requestCache).not.toContain('from "next/cache"');
    expect(profileResolver).not.toContain('from "next/cache"');
    expect(requestCache).toContain("readPublicDirectoryProfileCache");
    expect(profileResolver).toContain("readPublicDirectoryExtrasCache");
    expect(directoryCacheBoundary).toContain('from "next/cache"');
    expect(directoryCacheBoundary).toContain('"public-directory-miss-v2"');
    expect(directoryCacheBoundary).toContain('"public-directory-routing-miss-v2"');
    expect(directoryCacheBoundary).not.toContain('"public-directory-miss-v1"');
    expect(directoryCacheBoundary).not.toContain('"public-directory-routing-miss-v1"');
    expect(directoryCacheBoundary).toContain("PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG");
    expect(directoryCacheBoundary).toContain("invalidatePublishedDirectoryLocationSuggestionsCache");
    expect(fullRevalidation).toContain("invalidateMarketplaceHomeCompaniesCache");
    expect(publishedRevalidation).toContain("invalidateMarketplaceHomeCompaniesCache");
    expect(revalidationRoute).toContain("invalidateMarketplaceCacheBestEffort(\"full_revalidation_batch_success\")");
    expect(revalidationRoute).toContain("invalidateMarketplaceCacheBestEffort(\"full_revalidation_batch_failure\")");
  });
});
