import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");
const searchForm = source("src/components/company-directory/public-directory-search-form.tsx");
const results = source("src/components/company-directory/public-directory-results.tsx");
const profile = source("src/components/company-directory/public-directory-profile.tsx");

describe("Company Directory UX 2.0", () => {
  it("uses the Proffera Design System semantic tokens across the public directory", () => {
    for (const file of [searchPage, searchForm, results, profile]) {
      expect(file).toMatch(/bg-(canvas|surface|brand)/);
      expect(file).toContain("border-line");
      expect(file).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }

    expect(searchPage).toContain("bg-brand-deep");
    expect(searchForm).toContain("rounded-panel");
    expect(results).toContain("shadow-card");
    expect(profile).toContain("rounded-panel");
  });

  it("keeps search, nearby lookup and profile routing behavior intact", () => {
    expect(searchForm).toContain("navigator.geolocation.getCurrentPosition");
    expect(searchForm).toContain("normalizeDirectoryPublicServiceQuery");
    expect(searchPage).toContain("searchPublishedCompanyDirectory");
    expect(results).toContain("${profileBase}/${encodeURIComponent(result.slug)}");
  });

  it("keeps official-data context and quote comparison visually separate", () => {
    expect(results).toContain("t.officialData");
    expect(results).toContain("quoteRequestPaths[locale]");
    expect(profile).toContain("t.quoteDisclosure");
    expect(profile).toContain("t.sourceTitle");
    expect(profile).toContain("similarHref");
  });

  it("does not add client-side state to the server-rendered directory shell or profile", () => {
    expect(searchPage).not.toContain('"use client"');
    expect(results).not.toContain('"use client"');
    expect(profile).not.toContain('"use client"');
    expect(searchForm).toContain('"use client"');
  });
});
