import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locationSuggestions: vi.fn(async (limit: number) => [`location-${limit}`]),
  unstableCache: vi.fn((
    loader: (limit: number) => Promise<string[]>,
    _keyParts: string[],
    _options: { revalidate: number },
  ) => loader),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: mocks.unstableCache }));
vi.mock("@/lib/company-directory-public-search", () => ({
  getPublishedDirectoryLocationSuggestions: mocks.locationSuggestions,
}));

import { getCachedPublishedDirectoryLocationSuggestions } from "../src/lib/public-read-cache";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public read cache contract", () => {
  it("configures a bounded 30-minute cache and normalizes location suggestion limits", async () => {
    expect(mocks.unstableCache).toHaveBeenCalledTimes(1);
    const [, keyParts, options] = mocks.unstableCache.mock.calls[0];
    expect(keyParts).toEqual(["public-directory-location-suggestions-v3"]);
    expect(options).toEqual({ revalidate: 30 * 60 });

    await expect(getCachedPublishedDirectoryLocationSuggestions(999.9)).resolves.toEqual(["location-100"]);
    expect(mocks.locationSuggestions).toHaveBeenLastCalledWith(100);

    await expect(getCachedPublishedDirectoryLocationSuggestions(Number.NaN)).resolves.toEqual(["location-24"]);
    expect(mocks.locationSuggestions).toHaveBeenLastCalledWith(24);
  });

  it("routes only suggestion reads through the persistent cache boundary", () => {
    const homepage = source("src/components/marketplace/marketplace-home.tsx");
    const directorySearchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const sitemap = source("src/app/sitemap.ts");
    const requestCache = source("src/lib/company-directory-public-data.ts");

    expect(homepage).toContain("getCachedPublishedDirectoryLocationSuggestions(24)");
    expect(directorySearchPage).toContain("getCachedPublishedDirectoryLocationSuggestions(60)");
    expect(directorySearchPage).toContain("searchPublishedBusinessProfiles({");
    expect(sitemap).not.toContain("getCachedPlatformSitemapData");
    expect(sitemap).toContain("listPublicBusinessSitemapEntries()");
    expect(sitemap).toContain("listPublishedDirectorySitemapEntries()");
    expect(requestCache).not.toContain("unstable_cache");
    expect(requestCache).not.toContain("use cache");
  });
});
