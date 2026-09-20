import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locationSuggestions: vi.fn(async (limit: number) => [`location-${limit}`]),
  publicBusinessSitemapEntries: vi.fn(async () => [{ workspaceSlug: "example-ab", serviceSlug: null }]),
  marketplaceHomeCompanies: vi.fn(async ({ limit }: { limit: number }) => ({
    results: [{ id: `company-${limit}` }],
    totalCount: 1,
  })),
  unstableCache: vi.fn((
    loader: (...args: never[]) => Promise<unknown>,
    _keyParts: string[],
    _options: { revalidate: number },
  ) => loader),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: mocks.unstableCache }));
vi.mock("@/lib/business-profile-search", () => ({
  searchPublishedBusinessProfiles: mocks.marketplaceHomeCompanies,
}));
vi.mock("@/lib/company-directory-public-search", () => ({
  getPublishedDirectoryLocationSuggestions: mocks.locationSuggestions,
}));
vi.mock("@/lib/public-business-seo", () => ({
  listPublicBusinessSitemapEntries: mocks.publicBusinessSitemapEntries,
}));

import {
  getCachedMarketplaceHomeCompanies,
  getCachedPublishedDirectoryLocationSuggestions,
  getCachedPublicBusinessSitemapEntries,
} from "../src/lib/public-read-cache";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public read cache contract", () => {
  it("keeps Directory location suggestions for one day while preserving the 30-minute Public Business sitemap cache", async () => {
    expect(mocks.unstableCache).toHaveBeenCalledTimes(3);

    const locationCall = mocks.unstableCache.mock.calls.find(([, keyParts]) => keyParts[0] === "public-directory-location-suggestions-v3");
    expect(locationCall?.[2]).toEqual({ revalidate: 24 * 60 * 60 });

    const marketplaceCall = mocks.unstableCache.mock.calls.find(([, keyParts]) => keyParts[0] === "marketplace-home-companies-v1");
    expect(marketplaceCall?.[2]).toEqual({ revalidate: 30 * 60 });

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
  });

  it("keeps generic caches separate while Directory profile caching stays behind its audited boundary", () => {
    const homepage = source("src/components/marketplace/marketplace-home.tsx");
    const directorySearchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const sitemap = source("src/app/sitemap.ts");
    const requestCache = source("src/lib/company-directory-public-data.ts");
    const profileResolver = source("src/lib/business-profile-public.ts");
    const directoryCacheBoundary = source("src/lib/company-directory-public-cache.ts");

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
  });
});
