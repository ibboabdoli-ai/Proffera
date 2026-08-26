import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));

import {
  selectDirectoryGeocodingAddress,
  shouldRetryDirectoryNoMatchWithCanonicalAddress,
} from "@/lib/company-directory-geocoding";

const LEGACY_NO_MATCH = "lantmateriet_no_match_v4_2:no_reference";

const profileAddress = {
  addressLine1: "Gamla vägen 1",
  postalCode: "111 11",
  city: "Stockholm",
  municipality: "Stockholm",
};

const singleScbWorkplace = [{
  cfarNumber: "12345678",
  municipality: "Södertälje",
  visitingAddress: {
    addressLine: "NYA VÄGEN 2",
    postalCode: "151 00",
    city: "SÖDERTÄLJE",
  },
}];

const expectedWorkplace = {
  source: "scb_workplace" as const,
  address: {
    addressLine1: "NYA VÄGEN 2",
    postalCode: "151 00",
    city: "SÖDERTÄLJE",
    municipality: "Södertälje",
  },
};

describe("Directory geocoding SCB input guards", () => {
  it("accepts string-encoded SCB workplaces when conflicts are empty", () => {
    expect(selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: JSON.stringify(singleScbWorkplace),
      scbConflicts: "[]",
    })).toEqual(expectedWorkplace);
  });

  it("fails closed for malformed workplace JSON instead of using the profile address", () => {
    expect(selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: "{not-json",
      scbConflicts: [],
    })).toBeNull();
  });

  it("treats non-array SCB conflict payloads as conflicting", () => {
    for (const conflicts of [
      { field: "legal_name", code: "legal_name_mismatch" },
      JSON.stringify({ field: "legal_name", code: "legal_name_mismatch" }),
      1,
      true,
      "{not-json",
    ]) {
      expect(selectDirectoryGeocodingAddress({
        profileAddress,
        scbWorkplaces: singleScbWorkplace,
        scbConflicts: conflicts,
      })).toBeNull();
    }
  });

  it("keeps nullish and empty conflict payloads non-conflicting", () => {
    for (const conflicts of [null, undefined, "", "   "]) {
      expect(selectDirectoryGeocodingAddress({
        profileAddress,
        scbWorkplaces: JSON.stringify(singleScbWorkplace),
        scbConflicts: conflicts,
      })).toEqual(expectedWorkplace);
    }
  });

  it("returns no geocoding selection when there is no canonical workplace", () => {
    const selected = selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: [],
      scbConflicts: [],
    });

    expect(selected).toBeNull();
  });

  it("does not retry when the canonical workplace leaves the lookup address unchanged", () => {
    const unchangedWorkplace = [{
      cfarNumber: "99999999",
      municipality: profileAddress.municipality,
      visitingAddress: {
        addressLine: profileAddress.addressLine1,
        postalCode: profileAddress.postalCode,
        city: profileAddress.city,
      },
    }];
    const selected = selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: unchangedWorkplace,
      scbConflicts: [],
    });
    if (!selected) throw new Error("Expected canonical SCB workplace selection");

    expect(selected.source).toBe("scb_workplace");
    expect(shouldRetryDirectoryNoMatchWithCanonicalAddress({
      geocodeSource: LEGACY_NO_MATCH,
      profileAddress,
      selectedAddress: selected,
    })).toBe(false);
  });
});
