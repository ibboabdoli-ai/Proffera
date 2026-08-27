import { describe, expect, it } from "vitest";

import {
  buildDirectoryGeocodingNoMatchSource,
  selectDirectoryAddressReferenceCandidates,
  shouldRetryDirectoryNoMatchAfterRegisterUnitFix,
} from "./company-directory-geocoding";

const exactRegisterUnitId = "11111111-1111-4111-8111-111111111111";

function structuredReference(id: string, street: string, number = "7") {
  return {
    objektidentitet: id,
    adress: {
      kommun: "Stockholm",
      kommundel: "Stockholm",
      adressomrade: street,
      adressplatsnummer: number,
      postnummer: 11264,
      postort: "Stockholm",
    },
  };
}

describe("Lantmäteriet reference narrowing", () => {
  it("narrows more than five postal-compatible references to the exact structured street before the detail cap", () => {
    const candidates = selectDirectoryAddressReferenceCandidates([
      structuredReference("22222222-2222-4222-8222-222222222222", "Felgatan"),
      structuredReference("33333333-3333-4333-8333-333333333333", "Annan gata"),
      structuredReference("44444444-4444-4444-8444-444444444444", "Tredje gatan"),
      structuredReference("55555555-5555-4555-8555-555555555555", "Fjärde gatan"),
      structuredReference("66666666-6666-4666-8666-666666666666", "Femte gatan"),
      structuredReference("77777777-7777-4777-8777-777777777777", "Sjätte gatan"),
      structuredReference(exactRegisterUnitId, "Segelbåtsvägen"),
    ], "112 64", "STOCKHOLM", "Segelbåtsvägen 7");

    expect(candidates.map((candidate) => candidate.objektidentitet)).toEqual([
      exactRegisterUnitId,
    ]);
  });

  it("keeps compatible references when official structured street data is unavailable", () => {
    const candidates = selectDirectoryAddressReferenceCandidates([
      {
        objektidentitet: exactRegisterUnitId,
        adress: "Segelbåtsvägen 7, 112 64 Stockholm",
      },
      {
        objektidentitet: "22222222-2222-4222-8222-222222222222",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      },
    ], "11264", "Stockholm", "Segelbåtsvägen 7");

    expect(candidates.map((candidate) => candidate.objektidentitet)).toEqual([
      exactRegisterUnitId,
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("deduplicates repeated references for the same register unit after narrowing", () => {
    const candidates = selectDirectoryAddressReferenceCandidates([
      structuredReference(exactRegisterUnitId, "Segelbåtsvägen"),
      structuredReference(exactRegisterUnitId, "Segelbåtsvägen"),
    ], "11264", "Stockholm", "Segelbåtsvägen 7");

    expect(candidates).toHaveLength(1);
  });

  it("retries v1 failures once and makes v2 failures terminal", () => {
    const v1 = "lantmateriet_no_match_v4_2:registerenhet_v1:scb_workplace:invalid_reference";
    const v2 = buildDirectoryGeocodingNoMatchSource("invalid_reference", "scb_workplace");

    expect(v2).toBe("lantmateriet_no_match_v4_2:registerenhet_v2:scb_workplace:invalid_reference");
    expect(shouldRetryDirectoryNoMatchAfterRegisterUnitFix(v1)).toBe(true);
    expect(shouldRetryDirectoryNoMatchAfterRegisterUnitFix(v2)).toBe(false);
  });
});
