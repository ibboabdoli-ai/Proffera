import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory request cache contract", () => {
  it("uses one React request memoizer for public directory business data", () => {
    const helper = source("src/lib/company-directory-public-data.ts");
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const profile = source("src/components/company-directory/public-directory-profile.tsx");

    expect(helper).toContain('import { cache } from "react"');
    expect(helper).toContain("getPublicDirectoryBusinessForRequest = cache(async");
    expect(helper).toContain("await getPublicDirectoryBusiness(slug)");
    expect(helper).toContain("getSafeClaimedDirectoryFallback(slug)");
    expect(helper.match(/\bcache\(/g)?.length).toBe(1);

    for (const consumer of [swedishRoute, englishRoute, profile]) {
      expect(consumer).toContain("getPublicDirectoryBusinessForRequest");
      expect(consumer).not.toContain('from "@/lib/company-directory-engine"');
    }
  });

  it("keeps public profile routes dynamic instead of adding persistent cross-request caching", () => {
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const helper = source("src/lib/company-directory-public-data.ts");

    expect(swedishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(englishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(helper).not.toContain("unstable_cache");
    expect(helper).not.toContain("use cache");
  });
});
