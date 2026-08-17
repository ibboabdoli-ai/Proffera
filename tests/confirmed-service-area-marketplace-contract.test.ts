import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("confirmed service-area marketplace contract", () => {
  const servicesDb = source("src/lib/workspace-services-db.ts");
  const serviceActions = source("src/app/dashboard/installningar/service-actions.ts");
  const serviceEditor = source("src/app/dashboard/installningar/services-read-only.tsx");
  const readiness = source("src/lib/workspace-marketplace-readiness.ts");
  const matching = source("src/features/matching/list.ts");
  const directorySearch = source("src/lib/company-directory-public-search.ts");

  it("requires explicit owner confirmation instead of treating free text as coverage", () => {
    expect(serviceEditor).toContain('name="service_area_radius_km"');
    expect(serviceEditor).toContain('name="service_area_confirmed"');
    expect(serviceEditor).toContain("Registrerad företagsadress räknas inte som serviceområde");
    expect(serviceActions).toContain('formData.get("service_area_confirmed") === "on"');
    expect(serviceActions).toContain("serviceAreaRadiusKm === null");
  });

  it("writes only safe claimed, canonical, active and published owner service areas", () => {
    expect(servicesDb).toContain("profile.claimed_workspace_id::text = ${workspaceId}");
    expect(servicesDb).toContain("profile.publication_status = 'claimed'");
    expect(servicesDb).toContain("relation.service_slug = ${publicSlug}");
    expect(servicesDb).toContain("relation.public_visible = true");
    expect(servicesDb).toContain('input.publicStatus === "published"');
    expect(servicesDb).toContain("source_type, confidence, public_visible, confirmed_at");
    expect(servicesDb).toContain("'owner', 100, true, now(), now()");
    expect(servicesDb).toContain("company_directory_service_areas.source_type = 'owner'");
  });

  it("removes only owner evidence when a service stops qualifying", () => {
    expect(servicesDb).toContain("delete from company_directory_service_areas");
    expect(servicesDb).toContain("and source_type = 'owner'");
    expect(servicesDb).not.toContain("delete from company_directory_service_areas\n      where profile_id = ${profileId}::uuid\n        and service_slug = ${publicSlug}\n    ");
  });

  it("does not mark marketplace readiness from legacy free-text areas", () => {
    expect(readiness).toContain('serviceArea: service.serviceAreaConfirmed ? service.serviceArea : ""');
    expect(servicesDb).toContain("area.public_visible = true");
    expect(servicesDb).toContain("area.confirmed_at is not null");
  });

  it("gates lead suggestions and public marketplace actions on confirmed coverage", () => {
    expect(matching).toContain("company_directory_service_areas");
    expect(matching).toContain("area.confirmed_at is not null");
    expect(matching).toContain("case when confirmed_area.radius_km is not null then service.service_area else '' end as service_area");
    expect(directorySearch).toContain("const serviceAreaCoversSearch = serviceAreaRadiusKm !== null");
    expect(directorySearch).toContain("&& serviceAreaCoversSearch");
    expect(directorySearch).toContain("!nearbyEnabled || servesNearbyLocation");
  });
});
