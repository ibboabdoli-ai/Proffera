import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("public company directory search contract", () => {
  const searchSource = readFileSync(
    resolve(process.cwd(), "src/lib/company-directory-public-search.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    resolve(process.cwd(), "src/app/foretag/listad/page.tsx"),
    "utf8",
  );

  it("never exposes ready directory profiles through the public search", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("uses the canonical normalized service relations", () => {
    expect(searchSource).toContain("company_directory_profile_services");
    expect(searchSource).toContain("relation.public_visible = true");
    expect(searchSource).toContain("company_directory_services");
  });

  it("keeps city search separate from nearby geocoding eligibility", () => {
    expect(searchSource).not.toContain("requireCoordinates");
    expect(searchSource).not.toContain("company_directory_business_locations");
    expect(searchSource).not.toContain("lower(profile.address_line1) not like 'box %'");
  });

  it("links results only to the existing public listed-company profile route", () => {
    expect(pageSource).toContain("searchPublishedCompanyDirectory");
    expect(pageSource).toContain("/foretag/listad/${encodeURIComponent(result.slug)}");
    expect(pageSource).toContain("registrerade adress");
    expect(pageSource).toContain("Endast publicerade profiler");
  });
});
