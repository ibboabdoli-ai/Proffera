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
  const formSource = readFileSync(
    resolve(process.cwd(), "src/app/foretag/listad/PublicDirectorySearchForm.tsx"),
    "utf8",
  );

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
    expect(pageSource).toContain("PublicDirectorySearchForm");
    expect(pageSource).toContain("Populära tjänster");
    expect(pageSource).toContain("result.activityDescription");
    expect(pageSource).toContain("result.distanceKm.toFixed(1)");
    expect(formSource).toContain("directory-service-suggestions");
    expect(formSource).toContain("directory-location-suggestions");
    expect(formSource).toContain("navigator.geolocation.getCurrentPosition");
    expect(formSource).toContain("Nära mig");
  });

  it("links results only to the existing public listed-company profile route", () => {
    expect(pageSource).toContain("searchPublishedCompanyDirectory");
    expect(pageSource).toContain("/foretag/listad/${encodeURIComponent(result.slug)}");
    expect(pageSource).toContain("registrerade adress");
  });
});
