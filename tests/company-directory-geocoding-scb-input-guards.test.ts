import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));

import { selectDirectoryGeocodingAddress } from "@/lib/company-directory-geocoding";

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

  it("fails closed to the profile address for malformed workplace JSON", () => {
    expect(selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: "{not-json",
      scbConflicts: [],
    })).toEqual({ source: "profile", address: profileAddress });
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
      })).toEqual({ source: "profile", address: profileAddress });
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
});
