import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public read cache contract", () => {
  it("caches public location suggestions without changing search result freshness", () => {
    const cacheHelper = source("src/lib/public-read-cache.ts");
    const homepage = source("src/components/marketplace/marketplace-home.tsx");
    const directorySearchPage = source("src/components/company-directory/public-directory-search-page.tsx");

    expect(cacheHelper).toContain('import { unstable_cache } from "next/cache"');
    expect(cacheHelper).toContain("public-directory-location-suggestions-v2");
    expect(cacheHelper).toContain("LOCATION_SUGGESTIONS_REVALIDATE_SECONDS = 30 * 60");
    expect(homepage).toContain("getCachedPublishedDirectoryLocationSuggestions(24)");
    expect(directorySearchPage).toContain("getCachedPublishedDirectoryLocationSuggestions(60)");
    expect(homepage).not.toContain('from "@/lib/company-directory-public-search"');
    expect(directorySearchPage).toContain("searchPublishedBusinessProfiles({");
    expect(directorySearchPage).not.toContain("getPublishedDirectoryLocationSuggestions(60)");
  });

  it("caches platform sitemap DB reads while keeping host-aware sitemap routing dynamic", () => {
    const cacheHelper = source("src/lib/public-read-cache.ts");
    const sitemap = source("src/app/sitemap.ts");

    expect(cacheHelper).toContain("platform-sitemap-data-v2");
    expect(cacheHelper).toContain("SITEMAP_REVALIDATE_SECONDS = 15 * 60");
    expect(cacheHelper).toContain("listPublicBusinessSitemapEntries()");
    expect(cacheHelper).toContain("listPublishedDirectorySitemapEntries()");
    expect(cacheHelper).toContain("listDirectorySeoLandings()");
    expect(cacheHelper).toContain("entry.lastModified.toISOString()");
    expect(sitemap).toContain('export const dynamic = "force-dynamic"');
    expect(sitemap).toContain("getCachedPlatformSitemapData()");
    expect(sitemap).toContain("resolvePublicCustomDomain(host)");
    expect(sitemap).not.toContain("listPublishedDirectorySitemapEntries()");
  });

  it("preserves immediate privacy and publication behavior for individual directory profiles", () => {
    const swedishProfile = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
    const requestCache = source("src/lib/company-directory-public-data.ts");

    expect(swedishProfile).toContain('export const dynamic = "force-dynamic"');
    expect(englishProfile).toContain('export const dynamic = "force-dynamic"');
    expect(requestCache).not.toContain("unstable_cache");
    expect(requestCache).not.toContain("use cache");
  });
});
