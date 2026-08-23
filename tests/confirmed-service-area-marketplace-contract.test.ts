import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  confirmedCompanyDirectoryServiceAreaCoversSearch,
  hasConfirmedCompanyDirectoryServiceArea,
  normalizeCompanyDirectoryServiceAreaRadius,
} from "@/lib/company-directory-service-area-policy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("confirmed service-area runtime policy", () => {
  it("accepts only finite radii from 1 through 300 km", () => {
    expect(normalizeCompanyDirectoryServiceAreaRadius(1)).toBe(1);
    expect(normalizeCompanyDirectoryServiceAreaRadius("25")).toBe(25);
    expect(normalizeCompanyDirectoryServiceAreaRadius(300)).toBe(300);
    expect(normalizeCompanyDirectoryServiceAreaRadius(0)).toBeNull();
    expect(normalizeCompanyDirectoryServiceAreaRadius(301)).toBeNull();
    expect(normalizeCompanyDirectoryServiceAreaRadius(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("requires public and explicitly confirmed canonical evidence", () => {
    const confirmedAt = "2026-08-17T08:00:00.000Z";

    expect(hasConfirmedCompanyDirectoryServiceArea({ radiusKm: 25, publicVisible: true, confirmedAt })).toBe(true);
    expect(hasConfirmedCompanyDirectoryServiceArea({ radiusKm: 25, publicVisible: false, confirmedAt })).toBe(false);
    expect(hasConfirmedCompanyDirectoryServiceArea({ radiusKm: 25, publicVisible: true, confirmedAt: null })).toBe(false);
    expect(hasConfirmedCompanyDirectoryServiceArea({ radiusKm: 0, publicVisible: true, confirmedAt })).toBe(false);
    expect(hasConfirmedCompanyDirectoryServiceArea({ radiusKm: 301, publicVisible: true, confirmedAt })).toBe(false);
  });

  it("fails closed for nearby searches outside the confirmed radius", () => {
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: false, distanceKm: null })).toBe(true);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: true, distanceKm: 25 })).toBe(true);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: true, distanceKm: 25.01 })).toBe(false);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 0, nearbyEnabled: false, distanceKm: null })).toBe(false);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 301, nearbyEnabled: false, distanceKm: null })).toBe(false);
  });

  it("keeps non-owner evidence outside owner cleanup scope", () => {
    const evidence = [
      { id: "owner", sourceType: "owner" },
      { id: "admin", sourceType: "admin" },
      { id: "website", sourceType: "website" },
    ];
    const ownerCleanupTargets = evidence.filter((item) => item.sourceType === "owner");
    const preserved = evidence.filter((item) => item.sourceType !== "owner");

    expect(ownerCleanupTargets.map((item) => item.id)).toEqual(["owner"]);
    expect(preserved.map((item) => item.id)).toEqual(["admin", "website"]);
  });
});

describe("confirmed service-area integration wiring", () => {
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
    expect(serviceActions).toContain("normalizeCompanyDirectoryServiceAreaRadius");
  });

  it("keeps service mutation and canonical owner evidence in one database transaction", () => {
    expect(servicesDb.match(/sql\.transaction\(\[/g)?.length).toBe(2);
    expect(servicesDb).toContain("ownerServiceAreaMutationQuery(sql, workspaceId, primaryDirectoryServiceSlug, input)");
    expect(servicesDb).not.toContain("syncOwnerConfirmedServiceAreaSafely");
  });

  it("limits destructive cleanup to owner evidence", () => {
    const deleteStatements = servicesDb.match(/delete from company_directory_service_areas[\s\S]*?(?=`;|\n  `)/g) ?? [];

    expect(deleteStatements.length).toBeGreaterThanOrEqual(2);
    expect(deleteStatements.every((statement) => statement.includes("source_type = 'owner'"))).toBe(true);
  });

  it("requires canonical valid-radius evidence in every marketplace consumer", () => {
    expect(servicesDb).toContain("area.radius_km between 1 and 300");
    expect(readiness).toContain("service.serviceAreaConfirmed && service.serviceAreaRadiusKm !== null");
    expect(matching).toContain("area.radius_km between 1 and 300");
    expect(directorySearch).toContain("area.radius_km between 1 and 300");
    expect(directorySearch).toContain("confirmedCompanyDirectoryServiceAreaCoversSearch");
  });
});
