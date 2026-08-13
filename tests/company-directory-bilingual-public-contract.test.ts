import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

describe("bilingual public directory contract", () => {
  const copy = source("src/components/company-directory/public-directory-copy.ts");
  const form = source("src/components/company-directory/public-directory-search-form.tsx");
  const shell = source("src/components/company-directory/public-directory-search-page.tsx");
  const results = source("src/components/company-directory/public-directory-results.tsx");
  const englishSearch = source("src/app/en/companies/page.tsx");
  const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
  const profile = source("src/components/company-directory/public-directory-profile.tsx");
  const search = source("src/lib/company-directory-public-search.ts");

  it("keeps Swedish and English customer routes together", () => {
    expect(copy).toContain('search: "/foretag/listad"');
    expect(copy).toContain('search: "/en/companies"');
    expect(shell).toContain("directoryPaths[otherLocale].search");
    expect(englishSearch).toContain('locale="en"');
    expect(englishProfile).toContain('locale="en"');
  });

  it("accepts customer-facing English service terms without changing backend taxonomy", () => {
    expect(form).toContain('"plumber": "vvs"');
    expect(form).toContain('"electrician": "elinstallation"');
    expect(form).toContain('"window cleaning": "fonsterputsning"');
    expect(form).toContain("getServiceQuery");
  });

  it("localizes result labels while preserving official Swedish source text", () => {
    expect(results).toContain("directoryServiceLabel");
    expect(results).toContain('lang="sv"');
    expect(profile).toContain('lang="sv"');
  });

  it("does not weaken the public publication boundary", () => {
    expect(search).toContain("profile.publication_status = 'published'");
    expect(search).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(search).toContain("location.is_public = true");
  });

  it("does not expose the Swedish-only claim action on the English profile", () => {
    expect(profile).toContain('locale === "sv"');
    expect(profile).toContain("/foretag/claim/");
  });
});
