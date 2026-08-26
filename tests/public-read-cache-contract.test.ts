import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public read cache contract", () => {
  it("caches homepage location suggestions so repeat public traffic does not repeatedly wake Neon", () => {
    const cacheHelper = source("src/lib/public-read-cache.ts");
    const homepage = source("src/components/marketplace/marketplace-home.tsx");

    expect(cacheHelper).toContain('import { unstable_cache } from "next/cache"');
    expect(cacheHelper).toContain("public-home-location-suggestions-v1");
    expect(cacheHelper).toContain("HOMEPAGE_LOCATION_REVALIDATE_SECONDS = 30 * 60");
    expect(homepage).toContain("getCachedPublishedDirectoryLocationSuggestions(24)");
    expect(homepage).not.toContain('from "@/lib/company-directory-public-search"');
  });

  it("caches platform sitemap data while keeping the route host-aware and dynamic", () => {
    const cacheHelper = source("src/lib/public-read-cache.ts");
    const sitemap = source("src/app/sitemap.ts");

    expect(cacheHelper).toContain("platform-sitemap-data-v1");
    expect(cacheHelper).toContain("SITEMAP_REVALIDATE_SECONDS = 15 * 60");
    expect(cacheHelper).toContain("listPublicBusinessSitemapEntries()");
    expect(cacheHelper).toContain("listPublishedDirectorySitemapEntries()");
    expect(cacheHelper).toContain("listDirectorySeoLandings()");
    expect(sitemap).toContain('export const dynamic = "force-dynamic"');
    expect(sitemap).toContain("getCachedPlatformSitemapData()");
    expect(sitemap).not.toContain("listPublishedDirectorySitemapEntries()");
  });

  it("does not weaken the immediate privacy/publication behavior of individual directory profiles", () => {
    const swedishProfile = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
    const requestCache = source("src/lib/company-directory-public-data.ts");

    expect(swedishProfile).toContain('export const dynamic = "force-dynamic"');
    expect(englishProfile).toContain('export const dynamic = "force-dynamic"');
    expect(requestCache).not.toContain("unstable_cache");
    expect(requestCache).not.toContain("use cache");
  });
});
