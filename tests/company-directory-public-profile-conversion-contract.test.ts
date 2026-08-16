import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory public profile conversion contract", () => {
  const extras = source("src/lib/company-directory-public-profile-extras.ts");
  const profile = source("src/components/company-directory/public-directory-profile.tsx");
  const copy = source("src/components/company-directory/public-directory-profile-copy.ts");
  const swedishPage = source("src/app/foretag/listad/[slug]/page.tsx");
  const englishPage = source("src/app/en/companies/[slug]/page.tsx");

  it("shows only services explicitly marked public", () => {
    expect(extras).toContain("company_directory_profile_services");
    expect(extras).toContain("relation.is_active = true");
    expect(extras).toContain("relation.public_visible = true");
    expect(extras).toContain("service.is_active = true");
    expect(profile).toContain("directoryServiceLabel");
    expect(profile).toContain("service.sourceType === \"sni\"");
  });

  it("keeps service areas hidden until they are both public and confirmed", () => {
    expect(extras).toContain("company_directory_service_areas");
    expect(extras).toContain("area.public_visible = true");
    expect(extras).toContain("area.confirmed_at is not null");
    expect(profile).toContain("extras.serviceAreas.length");
  });

  it("provides a transparent conversion path without pretending to contact this company", () => {
    expect(profile).toContain("similarHref");
    expect(profile).toContain("similarService");
    expect(copy).toContain('similarCta: "Hitta liknande företag"');
    expect(copy).toContain('similarCta: "Find similar companies"');
    expect(profile).not.toContain("/fa-offert");
    expect(profile).not.toContain("/en/get-quote");
  });

  it("uses one shared profile renderer for Swedish and English", () => {
    expect(swedishPage).toContain("PublicDirectoryProfile");
    expect(swedishPage).toContain('locale="sv"');
    expect(englishPage).toContain("PublicDirectoryProfile");
    expect(englishPage).toContain('locale="en"');
  });

  it("emits sanitized LocalBusiness JSON-LD from the shared renderer", () => {
    expect(profile).toContain('"@type": "LocalBusiness"');
    expect(profile).toContain('type="application/ld+json"');
    expect(profile).toContain('JSON.stringify(structuredData).replace(/</g, "\\\\u003c")');
    expect(profile).toContain("isActualBusinessMedia");
  });
});
