import { describe, expect, it } from "vitest";

import {
  classifyDirectoryMarketplaceReadiness,
  selectDirectoryMarketplaceWorkplaceAddress,
} from "./company-directory-marketplace-readiness";

const visitingAddress = {
  addressLine: "ERIKSHÄLLSGATAN 40",
  postalCode: "151 46",
  city: "SÖDERTÄLJE",
};

describe("company directory marketplace readiness", () => {
  it("prefers a real SCB visiting address over a postal box", () => {
    expect(selectDirectoryMarketplaceWorkplaceAddress([
      {
        postalAddress: { addressLine: "BOX 123", postalCode: "111 11", city: "STOCKHOLM" },
        visitingAddress,
      },
    ])).toEqual({
      addressLine1: "ERIKSHÄLLSGATAN 40",
      postalCode: "151 46",
      city: "SÖDERTÄLJE",
      source: "scb_visiting_address",
    });
  });

  it("rejects box-only and Kivra-only workplace addresses", () => {
    expect(selectDirectoryMarketplaceWorkplaceAddress([
      {
        visitingAddress: null,
        postalAddress: { addressLine: "BOX: 4054", postalCode: "102 61", city: "STOCKHOLM" },
      },
      {
        visitingAddress: null,
        postalAddress: { addressLine: "Kivra: 5590000000", postalCode: "106 31", city: "STOCKHOLM" },
      },
    ])).toBeNull();
  });

  it("falls back to a usable SCB postal address when visiting address is absent", () => {
    expect(selectDirectoryMarketplaceWorkplaceAddress([
      {
        visitingAddress: null,
        postalAddress: { addressLine: "RINGVÄGEN 80", postalCode: "118 60", city: "STOCKHOLM" },
      },
    ])).toEqual({
      addressLine1: "RINGVÄGEN 80",
      postalCode: "118 60",
      city: "STOCKHOLM",
      source: "scb_postal_address",
    });
  });

  it("marks a company with SCB address and business email as waiting only for geocoding", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: "published",
      isActive: true,
      privacyBlocked: false,
      organizationKind: "juridical_person",
      claimedWorkspaceId: null,
      hasPublicService: true,
      latitude: null,
      longitude: null,
      scbWorkplaces: [{ visitingAddress }],
      scbEmail: "info@example-company.se",
      scbPhone: "",
      scbConflicts: [],
    });

    expect(readiness.eligible).toBe(true);
    expect(readiness.needsGeocoding).toBe(true);
    expect(readiness.potentialAutoOutreachAfterGeocoding).toBe(true);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.autoOutreachReady).toBe(false);
  });

  it("counts a valid phone as Marketplace contact without pretending email automation is ready", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: "published",
      isActive: true,
      privacyBlocked: false,
      organizationKind: "juridical_person",
      claimedWorkspaceId: null,
      hasPublicService: true,
      latitude: 59.1955,
      longitude: 17.6253,
      scbWorkplaces: [{ visitingAddress }],
      scbEmail: "person@gmail.com",
      scbPhone: "+46 70 123 45 67",
      scbConflicts: [],
    });

    expect(readiness.marketplaceReady).toBe(true);
    expect(readiness.autoOutreachReady).toBe(false);
    expect(readiness.businessEmail).toBe("");
    expect(readiness.phone).toBe("+46 70 123 45 67");
  });

  it("fails closed when SCB has conflicts", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: "published",
      isActive: true,
      privacyBlocked: false,
      organizationKind: "juridical_person",
      claimedWorkspaceId: null,
      hasPublicService: true,
      latitude: 59.1955,
      longitude: 17.6253,
      scbWorkplaces: [{ visitingAddress }],
      scbEmail: "info@example-company.se",
      scbPhone: "+46 70 123 45 67",
      scbConflicts: [{ field: "name" }],
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.autoOutreachReady).toBe(false);
    expect(readiness.businessEmail).toBe("");
    expect(readiness.phone).toBe("");
    expect(readiness.reasons).toContain("scb_conflict");
  });

  it("keeps claimed profiles on the workspace route instead of Guest Outreach", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: "published",
      isActive: true,
      privacyBlocked: false,
      organizationKind: "juridical_person",
      claimedWorkspaceId: "47d9e1ac-b650-4d92-a1c5-4c6a9b4ebc4e",
      hasPublicService: true,
      latitude: 59.1955,
      longitude: 17.6253,
      scbWorkplaces: [{ visitingAddress }],
      scbEmail: "info@example-company.se",
      scbPhone: "",
      scbConflicts: [],
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons).toContain("claimed_workspace_route");
  });
});
