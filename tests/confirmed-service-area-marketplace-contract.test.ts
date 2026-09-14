import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyCompanyDirectoryGeoCoverage,
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

  it("keeps the exact confirmed radius boundary inclusive", () => {
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: false, distanceKm: null })).toBe(true);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: true, distanceKm: 25 })).toBe(true);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 25, nearbyEnabled: true, distanceKm: 25.01 })).toBe(false);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 0, nearbyEnabled: false, distanceKm: null })).toBe(false);
    expect(confirmedCompanyDirectoryServiceAreaCoversSearch({ radiusKm: 301, nearbyEnabled: false, distanceKm: null })).toBe(false);
  });

  it("classifies deterministic confirmed coverage before every fallback", () => {
    const inside = classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.1955,
      providerLongitude: 17.6253,
      providerPointVerified: true,
      customerLatitude: 59.1955,
      customerLongitude: 17.6253,
      confirmedRadiusKm: 25,
      localityMatched: true,
    });
    const outside = classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.1955,
      providerLongitude: 17.6253,
      providerPointVerified: true,
      customerLatitude: 59.30,
      customerLongitude: 17.70,
      confirmedRadiusKm: 5,
      localityMatched: true,
      fallbackMaxDistanceKm: 50,
    });

    expect(inside.state).toBe("confirmed_inside");
    expect(outside.state).toBe("confirmed_outside");
    expect(outside.distanceKm).not.toBeNull();
  });

  it("keeps unconfirmed proximity and locality explicitly unconfirmed", () => {
    expect(classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.20,
      providerLongitude: 17.63,
      customerLatitude: 59.1955,
      customerLongitude: 17.6253,
      fallbackMaxDistanceKm: 50,
    }).state).toBe("inferred_nearby");

    expect(classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.20,
      providerLongitude: 17.63,
      customerLatitude: null,
      customerLongitude: null,
      localityMatched: true,
    }).state).toBe("locality_fallback");
  });

  it("fails closed for missing provider points, malformed geometry, or unverified confirmed points", () => {
    expect(classifyCompanyDirectoryGeoCoverage({
      providerLatitude: null,
      providerLongitude: null,
      customerLatitude: 59.1955,
      customerLongitude: 17.6253,
    }).state).toBe("unknown");

    expect(classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.20,
      providerLongitude: 17.63,
      customerLatitude: "bad",
      customerLongitude: 17.6253,
    }).state).toBe("unknown");

    expect(classifyCompanyDirectoryGeoCoverage({
      providerLatitude: 59.20,
      providerLongitude: 17.63,
      providerPointVerified: false,
      customerLatitude: 59.1955,
      customerLongitude: 17.6253,
      confirmedRadiusKm: 25,
    }).state).toBe("unknown");
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
  const matchingPolicy = source("src/features/matching/policy.ts");
  const guestMatching = source("src/features/matching/directory-guest.ts");
  const guestSingle = source("src/features/matching/directory-guest-single.ts");
  const wavePlan = source("src/features/matching/marketplace-wave-plan.ts");
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

  it("requires canonical valid-radius evidence and service-specific precedence", () => {
    expect(servicesDb).toContain("area.radius_km between 1 and 300");
    expect(readiness).toContain("service.serviceAreaConfirmed && service.serviceAreaRadiusKm !== null");
    expect(matching).toContain("area.radius_km between 1 and 300");
    expect(matching).toContain("case when area.service_slug = service.public_slug then 0 else 1 end");
    expect(guestMatching).toContain("case when area.service_slug = relation.service_slug then 0 else 1 end");
    expect(guestSingle).toContain("case when area.service_slug = relation.service_slug then 0 else 1 end");
    expect(directorySearch).toContain("area.radius_km between 1 and 300");
    expect(directorySearch).toContain("confirmedCompanyDirectoryServiceAreaCoversSearch");
  });

  it("uses one shared geo classifier instead of free-text service area geometry", () => {
    expect(matchingPolicy).toContain("classifyCompanyDirectoryGeoCoverage");
    expect(guestMatching).toContain("classifyCompanyDirectoryGeoCoverage");
    expect(matchingPolicy).not.toContain("textsOverlap(candidate.serviceArea, lead.city)");
    expect(matching).toContain("customerLatitude: rawLead.customer_latitude");
    expect(matching).toContain("providerPointVerified: isVerifiedDirectoryMarketplaceLocation");
  });

  it("fails closed at the automatic Marketplace invitation boundary", () => {
    expect(wavePlan).toContain('candidate.coverageState === "confirmed_inside"');
    expect(wavePlan).toContain("candidate.serviceAreaConfirmed === true");
  });
});
