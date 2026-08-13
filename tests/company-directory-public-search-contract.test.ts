import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public company directory search contract", () => {
  const searchSource = source("src/lib/company-directory-public-search.ts");
  const pageSource = source("src/app/foretag/listad/page.tsx");
  const shellSource = source("src/components/company-directory/public-directory-search-page.tsx");
  const resultsSource = source("src/components/company-directory/public-directory-results.tsx");
  const formSource = source("src/components/company-directory/public-directory-search-form.tsx");
  const copySource = source("src/components/company-directory/public-directory-copy.ts");

  it("never exposes ready directory profiles through the public search", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("uses canonical service relations and public verified coordinates", () => {
    expect(searchSource).toContain("company_directory_profile_services");
    expect(searchSource).toContain("relation.public_visible = true");
    expect(searchSource).toContain("company_directory_services");
    expect(searchSource).toContain("company_directory_business_locations");
    expect(searchSource).toContain("location.is_public = true");
  });

  it("keeps exact city search usable without requiring coordinates", () => {
    expect(searchSource).toContain("${nearbyEnabled} = true");
    expect(searchSource).toContain("or lower(profile.city) = ${normalizedLocation}");
    expect(searchSource).toContain("${nearbyEnabled} = false");
    expect(searchSource).not.toContain("lower(profile.address_line1) not like 'box %'");
  });

  it("supports nearby radius filtering without inferred service areas", () => {
    expect(searchSource).toContain("distance_km <= ${radiusKm}");
    expect(searchSource).toContain("6371 * 2 * asin");
    expect(searchSource).not.toContain("company_directory_service_areas");
  });

  it("adds autocomplete, nearby search, popular services and richer result cards", () => {
    expect(pageSource).toContain('PublicDirectorySearchPage locale="sv"');
    expect(shellSource).toContain("PublicDirectorySearchForm");
    expect(shellSource).toContain("popularDirectoryServices");
    expect(resultsSource).toContain("result.activityDescription");
    expect(resultsSource).toContain("result.distanceKm");
    expect(copySource).toContain("toFixed(1)");
    expect(formSource).toContain("directory-service-suggestions");
    expect(formSource).toContain("directory-location-suggestions");
    expect(formSource).toContain("navigator.geolocation.getCurrentPosition");
    expect(copySource).toContain("Nära mig");
  });

  it("keeps search and profile routing in the shared public directory graph", () => {
    expect(shellSource).toContain("searchPublishedCompanyDirectory");
    expect(resultsSource).toContain("${profileBase}/${encodeURIComponent(result.slug)}");
    expect(copySource).toContain("registrerade adress");
    expect(copySource).toContain('search: "/foretag/listad"');
    expect(copySource).toContain('search: "/en/companies"');
  });
});
