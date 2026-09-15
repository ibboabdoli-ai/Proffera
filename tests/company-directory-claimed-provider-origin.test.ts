import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isVerifiedClaimedProviderServiceBase,
  selectClaimedProviderMatchingOrigin,
} from "@/lib/company-directory-claimed-provider-origin";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const verifiedServiceBase = {
  candidateCount: 1,
  ownerWorkspaceId: workspaceId,
  sourceType: "owner",
  purpose: "service_base",
  isActive: true,
  confirmedAt: "2026-09-15T08:00:00.000Z",
  latitude: 59.1955,
  longitude: 17.6253,
  geocodeSource: "lantmateriet_belagenhetsadress_v4_2",
  geocodePrecision: "address",
  city: "Södertälje",
  municipality: "Södertälje",
};
const canonical = {
  latitude: 59.33,
  longitude: 18.06,
  city: "Stockholm",
  municipality: "Stockholm",
  pointVerified: true,
};

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("claimed provider matching origin", () => {
  it("prefers one verified owner service base over the canonical SCB point", () => {
    expect(isVerifiedClaimedProviderServiceBase({
      claimedWorkspaceId: workspaceId,
      serviceBase: verifiedServiceBase,
    })).toBe(true);

    expect(selectClaimedProviderMatchingOrigin({
      claimedWorkspaceId: workspaceId,
      serviceBase: verifiedServiceBase,
      canonical,
    })).toEqual({
      kind: "owner_service_base",
      latitude: 59.1955,
      longitude: 17.6253,
      city: "Södertälje",
      municipality: "Södertälje",
      pointVerified: true,
    });
  });

  it("fails closed to canonical SCB when ownership, confirmation, coordinates, or verification are invalid", () => {
    const invalidBases = [
      { ...verifiedServiceBase, ownerWorkspaceId: "22222222-2222-4222-8222-222222222222" },
      { ...verifiedServiceBase, confirmedAt: null },
      { ...verifiedServiceBase, latitude: null, longitude: null },
      { ...verifiedServiceBase, geocodeSource: "owner" },
      { ...verifiedServiceBase, geocodePrecision: "street" },
      { ...verifiedServiceBase, isActive: false },
      { ...verifiedServiceBase, purpose: "workplace" },
    ];

    for (const serviceBase of invalidBases) {
      expect(selectClaimedProviderMatchingOrigin({
        claimedWorkspaceId: workspaceId,
        serviceBase,
        canonical,
      })).toEqual({
        kind: "canonical_scb",
        ...canonical,
        pointVerified: true,
      });
    }
  });

  it("does not choose silently when more than one verified service base is eligible", () => {
    expect(selectClaimedProviderMatchingOrigin({
      claimedWorkspaceId: workspaceId,
      serviceBase: { ...verifiedServiceBase, candidateCount: 2 },
      canonical,
    }).kind).toBe("canonical_scb");
  });

  it("preserves canonical verification state when no owner service base is selected", () => {
    expect(selectClaimedProviderMatchingOrigin({
      claimedWorkspaceId: workspaceId,
      serviceBase: null,
      canonical: { ...canonical, pointVerified: false },
    })).toEqual({
      kind: "canonical_scb",
      latitude: canonical.latitude,
      longitude: canonical.longitude,
      city: canonical.city,
      municipality: canonical.municipality,
      pointVerified: false,
    });
  });
});

describe("claimed provider origin wiring", () => {
  const matching = source("src/features/matching/list.ts");
  const guestMatching = source("src/features/matching/directory-guest.ts");
  const guestSingle = source("src/features/matching/directory-guest-single.ts");

  it("binds owner service-base selection to the claimed Workspace and exact Lantmäteriet evidence", () => {
    expect(matching).toContain("company_directory_profile_locations owner_base");
    expect(matching).toContain("owner_base.owner_workspace_id = profile.claimed_workspace_id");
    expect(matching).toContain("owner_base.source_type = 'owner'");
    expect(matching).toContain("owner_base.purpose = 'service_base'");
    expect(matching).toContain("owner_base.confirmed_at is not null");
    expect(matching).toContain("owner_base.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'");
    expect(matching).toContain("owner_base.geocode_precision = 'address'");
    expect(matching).toContain("(count(*) over ())::int as matching_candidate_count");
    expect(matching).toContain("selectClaimedProviderMatchingOrigin");
    expect(matching).toContain("providerPointVerified: isVerifiedDirectoryMarketplaceLocation");
  });

  it("keeps unclaimed guest matching on the strict canonical SCB path", () => {
    expect(guestMatching).toContain("profile.claimed_workspace_id is null");
    expect(guestSingle).toContain("profile.claimed_workspace_id is null");
    expect(guestMatching).not.toContain("company_directory_profile_locations owner_base");
    expect(guestSingle).not.toContain("company_directory_profile_locations owner_base");
  });
});
