import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

describe("bilingual public directory contract", () => {
  const copy = source("src/components/company-directory/public-directory-copy.ts");
  const form = source("src/components/company-directory/public-directory-search-form.tsx");
  const shell = source("src/components/company-directory/public-directory-search-page.tsx");
  const header = source("src/components/layout/header.tsx");
  const localeRouting = source("src/lib/public-locale.ts");
  const results = source("src/components/company-directory/public-directory-results.tsx");
  const globals = source("src/app/globals.css");
  const swedishProfile = source("src/app/foretag/listad/[slug]/page.tsx");
  const englishSearch = source("src/app/en/companies/page.tsx");
  const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
  const profile = source("src/components/company-directory/public-directory-profile.tsx");
  const search = source("src/lib/company-directory-public-search.ts");

  it("keeps Swedish and English customer routes together", () => {
    expect(copy).toContain('search: "/foretag/listad"');
    expect(copy).toContain('search: "/en/companies"');
    expect(localeRouting).toContain('{ sv: "/foretag/listad", en: "/en/companies" }');
    expect(header).toContain("getAlternateLocalePath(pathname)");
    expect(englishSearch).toContain('locale="en"');
    expect(englishProfile).toContain('locale="en"');
    expect(swedishProfile).toContain("PublicDirectoryProfile");
    expect(swedishProfile).toContain('locale="sv"');
    expect(profile).toContain("alternateBase");
    expect(profile).toContain("t.language");
  });

  it("normalizes customer-facing English service terms on both client and server", () => {
    expect(copy).toContain('plumber: "vvs"');
    expect(copy).toContain('electrician: "elinstallation"');
    expect(copy).toContain('"window cleaning": "fonsterputsning"');
    expect(copy).toContain("normalizeDirectoryPublicServiceQuery");
    expect(form).toContain("normalizeDirectoryPublicServiceQuery");
    expect(shell).toContain("const searchService = normalizeDirectoryPublicServiceQuery(service, locale)");
    expect(shell).toContain("service: searchService");
  });

  it("localizes comparison-card labels while keeping official Swedish source text on profiles", () => {
    expect(results).toContain("directoryServiceLabel");
    expect(results).toContain("t.verifiedDetails");
    expect(results).not.toContain("result.activityDescription");
    expect(profile).toContain('lang="sv"');
  });

  it("shows the real profile check date in both public languages", () => {
    const profileCopy = source("src/components/company-directory/public-directory-profile-copy.ts");
    const engine = source("src/lib/company-directory-engine.ts");

    expect(profileCopy).toContain('lastChecked: "Senast kontrollerad"');
    expect(profileCopy).toContain('lastChecked: "Last checked"');
    expect(profile).toContain("business.lastCheckedAt");
    expect(profile).toContain("t.lastChecked");
    expect(engine).toContain("profile.last_synced_at");
    expect(engine).toContain("lastCheckedAt: row.last_synced_at");
  });

  it("scopes the contrast override to result CTAs so locale links remain readable", () => {
    expect(results).toContain("directory-profile-result-cta");
    expect(globals).toContain(".directory-profile-result-cta");
    expect(globals).not.toContain('a[href^="/en/companies/"]');
    expect(globals).not.toContain('a[href^="/foretag/listad/"]');
  });

  it("publishes reciprocal language metadata for Swedish company profiles", () => {
    expect(swedishProfile).toContain('"sv-SE": swedishPath');
    expect(swedishProfile).toContain("en: englishPath");
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
