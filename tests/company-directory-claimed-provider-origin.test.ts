import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getLeadMatches } from "@/features/matching/list";
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

function candidateRow(input: {
  workspaceId: string;
  companyName: string;
  canonicalCity: string;
  canonicalLatitude: number;
  canonicalLongitude: number;
  serviceBaseOwnerWorkspaceId: string;
  serviceBaseCandidateCount: number;
  serviceBaseCity: string;
  serviceBaseLatitude: number;
  serviceBaseLongitude: number;
}) {
  return {
    workspace_id: input.workspaceId,
    company_name: input.companyName,
    primary_city: input.canonicalCity,
    email: `${input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}@example.se`,
    phone: "0700000000",
    workspace_status: "active",
    claimed_profile_id: `${input.workspaceId.slice(0, 24)}aaaaaaaaaaaa`,
    claimed_profile_category_slug: "vvs",
    claimed_profile_is_active: true,
    claimed_profile_privacy_blocked: false,
    provider_city: input.canonicalCity,
    provider_municipality: input.canonicalCity,
    claim_status: "claimed",
    claim_verified_at: "2026-09-01T10:00:00.000Z",
    claim_resolved_at: "2026-09-01T10:05:00.000Z",
    service_id: `${input.workspaceId.slice(0, 24)}bbbbbbbbbbbb`,
    service_name: "VVS / Rörmokare",
    service_category: "VVS",
    service_area: input.canonicalCity,
    service_area_radius_km: 5,
    provider_latitude: input.canonicalLatitude,
    provider_longitude: input.canonicalLongitude,
    geocode_source: "lantmateriet_belagenhetsadress_v4_2",
    geocode_precision: "address",
    geocode_confidence: 100,
    geocoded_at: "2026-09-01T09:00:00.000Z",
    location_is_public: true,
    service_base_candidate_count: input.serviceBaseCandidateCount,
    service_base_owner_workspace_id: input.serviceBaseOwnerWorkspaceId,
    service_base_source_type: "owner",
    service_base_purpose: "service_base",
    service_base_is_active: true,
    service_base_confirmed_at: "2026-09-15T08:00:00.000Z",
    service_base_latitude: input.serviceBaseLatitude,
    service_base_longitude: input.serviceBaseLongitude,
    service_base_geocode_source: "lantmateriet_belagenhetsadress_v4_2",
    service_base_geocode_precision: "address",
    service_base_city: input.serviceBaseCity,
    service_base_municipality: input.serviceBaseCity,
    service_is_active: true,
    service_public_status: "published",
    service_conversion_mode: "quote",
    feature_minimum_plan: "starter",
    workspace_feature_enabled: true,
    admin_override_enabled: null,
    plan_key: "starter",
    plan_status: "active",
    plan_period_end: null,
    trial_status: null,
    trial_ends_at: null,
  };
}

describe("claimed provider matching origin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReset();
  });

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

  it("applies owner service-base origin only to the matching owner through getLeadMatches", async () => {
    const sameOwnerWorkspace = "11111111-1111-4111-8111-111111111111";
    const wrongOwnerWorkspace = "22222222-2222-4222-8222-222222222222";
    const ambiguousWorkspace = "33333333-3333-4333-8333-333333333333";
    const farLatitude = 59.3293;
    const farLongitude = 18.0686;

    let callIndex = 0;
    const sql = vi.fn(async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            reference_id: "QR-COORDINATE",
            category: "VVS",
            service_type: "VVS / Rörmokare",
            city: "Södertälje",
            postal_code: "151 46",
            description: "Koordinatkontroll",
            status: "submitted",
            created_at: "2026-09-15T08:00:00.000Z",
            customer_latitude: 59.1955,
            customer_longitude: 17.6253,
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            reference_id: "QR-LOCALITY",
            category: "VVS",
            service_type: "VVS / Rörmokare",
            city: "Södertälje",
            postal_code: "151 46",
            description: "Lokalitetskontroll",
            status: "submitted",
            created_at: "2026-09-15T07:00:00.000Z",
            customer_latitude: null,
            customer_longitude: null,
          },
        ];
      }

      return [
        candidateRow({
          workspaceId: sameOwnerWorkspace,
          companyName: "Same Owner AB",
          canonicalCity: "Stockholm",
          canonicalLatitude: farLatitude,
          canonicalLongitude: farLongitude,
          serviceBaseOwnerWorkspaceId: sameOwnerWorkspace,
          serviceBaseCandidateCount: 1,
          serviceBaseCity: "Södertälje",
          serviceBaseLatitude: 59.1955,
          serviceBaseLongitude: 17.6253,
        }),
        candidateRow({
          workspaceId: wrongOwnerWorkspace,
          companyName: "Wrong Owner AB",
          canonicalCity: "Södertälje",
          canonicalLatitude: 59.1955,
          canonicalLongitude: 17.6253,
          serviceBaseOwnerWorkspaceId: sameOwnerWorkspace,
          serviceBaseCandidateCount: 1,
          serviceBaseCity: "Stockholm",
          serviceBaseLatitude: farLatitude,
          serviceBaseLongitude: farLongitude,
        }),
        candidateRow({
          workspaceId: ambiguousWorkspace,
          companyName: "Ambiguous Base AB",
          canonicalCity: "Södertälje",
          canonicalLatitude: 59.1955,
          canonicalLongitude: 17.6253,
          serviceBaseOwnerWorkspaceId: ambiguousWorkspace,
          serviceBaseCandidateCount: 2,
          serviceBaseCity: "Stockholm",
          serviceBaseLatitude: farLatitude,
          serviceBaseLongitude: farLongitude,
        }),
      ];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await getLeadMatches();

    expect(result.ok).toBe(true);
    expect(result.matches).toHaveLength(2);

    const coordinateMatch = result.matches.find((match) => match.lead.reference_id === "QR-COORDINATE");
    expect(coordinateMatch?.suggestions.map((suggestion) => suggestion.companyName).sort()).toEqual([
      "Ambiguous Base AB",
      "Same Owner AB",
      "Wrong Owner AB",
    ]);
    expect(coordinateMatch?.suggestions.every((suggestion) => suggestion.coverageState === "confirmed_inside")).toBe(true);
    expect(coordinateMatch?.suggestions.every((suggestion) => suggestion.distanceKm === 0)).toBe(true);

    const localityMatch = result.matches.find((match) => match.lead.reference_id === "QR-LOCALITY");
    expect(localityMatch?.suggestions.map((suggestion) => suggestion.companyName).sort()).toEqual([
      "Ambiguous Base AB",
      "Same Owner AB",
      "Wrong Owner AB",
    ]);
    expect(localityMatch?.suggestions.every((suggestion) => suggestion.coverageState === "locality_fallback")).toBe(true);
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
