import { describe, expect, it } from "vitest";

import {
  classifyDirectoryMarketplaceReadiness,
  isVerifiedDirectoryMarketplaceLocation,
  selectDirectoryMarketplaceWorkplaceAddress,
} from "./company-directory-marketplace-readiness";

const visitingAddress = {
  addressLine: "ERIKSHÄLLSGATAN 40",
  postalCode: "151 46",
  city: "SÖDERTÄLJE",
};

const verifiedLocation = {
  latitude: 59.1955,
  longitude: 17.6253,
  geocodeSource: "lantmateriet_belagenhetsadress_v4_2",
  geocodePrecision: "address",
  geocodeConfidence: 100,
  geocodedAt: "2026-08-22T12:00:00.000Z",
  locationIsPublic: true,
};

function baseInput() {
  return {
    publicationStatus: "published",
    isActive: true,
    privacyBlocked: false,
    organizationKind: "juridical_person",
    claimedWorkspaceId: null,
    hasPublicService: true,
    scbWorkplaces: [{ visitingAddress }],
    scbEmail: "info@example-company.se",
    scbPhone: "",
    scbConflicts: [],
  };
}

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

  it("fails closed when multiple distinct visiting workplaces are present", () => {
    const scbWorkplaces = [
      { visitingAddress },
      {
        visitingAddress: {
          addressLine: "RINGVÄGEN 80",
          postalCode: "118 60",
          city: "STOCKHOLM",
        },
      },
    ];

    expect(selectDirectoryMarketplaceWorkplaceAddress(scbWorkplaces)).toBeNull();
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      scbWorkplaces,
    });
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.reasons).toContain("ambiguous_workplace");
  });

  it("marks a company with SCB address and business email as waiting only for geocoding", () => {
    const readiness = classifyDirectoryMarketplaceReadiness(baseInput());

    expect(readiness.eligible).toBe(true);
    expect(readiness.guestEligible).toBe(true);
    expect(readiness.needsGeocoding).toBe(true);
    expect(readiness.potentialAutoOutreachAfterGeocoding).toBe(true);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.autoOutreachReady).toBe(false);
  });

  it("does not treat arbitrary finite coordinates as verified", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      latitude: 59.1955,
      longitude: 17.6253,
      locationIsPublic: true,
    });

    expect(readiness.hasVerifiedCoordinates).toBe(false);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.needsGeocoding).toBe(true);
  });

  it("accepts only exact verified Lantmäteriet address coordinates", () => {
    expect(isVerifiedDirectoryMarketplaceLocation(verifiedLocation)).toBe(true);
    expect(isVerifiedDirectoryMarketplaceLocation({
      ...verifiedLocation,
      geocodeSource: "manual",
    })).toBe(false);
  });

  it("requires an address even when verified coordinates and contact exist", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      scbWorkplaces: [],
    });

    expect(readiness.hasVerifiedCoordinates).toBe(true);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.reasons).toContain("missing_workplace_address");
  });

  it("counts a valid phone as Marketplace contact without pretending email automation is ready", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      scbEmail: "person@gmail.com",
      scbPhone: "+46 70 123 45 67",
    });

    expect(readiness.marketplaceReady).toBe(true);
    expect(readiness.autoOutreachReady).toBe(false);
    expect(readiness.businessEmail).toBe("");
    expect(readiness.phone).toBe("+46 70 123 45 67");
  });

  it("rejects alphabetic phone values", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      scbEmail: "person@gmail.com",
      scbPhone: "abc1234567",
    });

    expect(readiness.phone).toBe("");
    expect(readiness.needsContact).toBe(true);
    expect(readiness.marketplaceReady).toBe(false);
  });

  it("fails closed when SCB has conflicts", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      scbPhone: "+46 70 123 45 67",
      scbConflicts: [{ field: "name" }],
    });

    expect(readiness.eligible).toBe(false);
    expect(readiness.guestEligible).toBe(false);
    expect(readiness.marketplaceReady).toBe(false);
    expect(readiness.autoOutreachReady).toBe(false);
    expect(readiness.businessEmail).toBe("");
    expect(readiness.phone).toBe("");
    expect(readiness.reasons).toContain("scb_conflict");
  });

  it("routes claimed Marketplace-ready profiles to Workspace instead of Guest Outreach", () => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      ...baseInput(),
      ...verifiedLocation,
      claimedWorkspaceId: "47d9e1ac-b650-4d92-a1c5-4c6a9b4ebc4e",
    });

    expect(readiness.eligible).toBe(true);
    expect(readiness.guestEligible).toBe(false);
    expect(readiness.marketplaceReady).toBe(true);
    expect(readiness.autoOutreachReady).toBe(false);
    expect(readiness.reasons).toContain("claimed_workspace_route");
  });
});
