import { describe, expect, it } from "vitest";

import { diagnoseExactSwerefAddressFromRegisterUnit } from "./company-directory-geocoding";

const registerUnitId = "11111111-1111-4111-8111-111111111111";
const otherRegisterUnitId = "22222222-2222-4222-8222-222222222222";
const addressId = "33333333-3333-4333-8333-333333333333";
const secondAddressId = "44444444-4444-4444-8444-444444444444";

function feature(input: {
  id?: string;
  propertyId?: string;
  registerId?: string;
  includeRegisterReference?: boolean;
  street?: string;
  number?: string;
  geometry?: unknown;
} = {}) {
  const id = input.id ?? addressId;
  return {
    type: "Feature",
    id,
    geometry: input.geometry ?? { type: "Point", coordinates: [674000, 6580000] },
    properties: {
      objektidentitet: input.propertyId ?? id,
      ...(input.includeRegisterReference === false
        ? {}
        : { registerenhetsreferens: { objektidentitet: input.registerId ?? registerUnitId } }),
      adressplatsattribut: {
        postnummer: 11264,
        postort: "Stockholm",
        adressplatsbeteckning: { adressplatsnummer: input.number ?? "7", bokstavstillagg: "A" },
      },
      adressomrade: { faststalltNamn: input.street ?? "Segelbåtsvägen" },
    },
  };
}

function collection(...features: unknown[]) {
  return { type: "FeatureCollection", features };
}

describe("Lantmäteriet register-unit address matching", () => {
  it("returns the exact address UUID rather than the register-unit UUID", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature()),
      registerUnitId,
      "112 64",
      "Stockholm",
      "Segelbåtsvägen 7 A",
    )).toEqual({
      point: { easting: 674000, northing: 6580000 },
      addressId,
      reason: null,
    });
  });

  it("accepts one exact address among multiple addresses on the same register unit", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(
        feature({ id: secondAddressId, street: "Annan gata", number: "9" }),
        feature(),
      ),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toMatchObject({ addressId, reason: null });
  });

  it("fails closed when two addresses are both exact matches", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature(), feature({ id: secondAddressId })),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toEqual({ point: null, addressId: null, reason: "ambiguous_exact_match" });
  });

  it("fails closed on a register-unit mismatch", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature({ registerId: otherRegisterUnitId })),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toEqual({ point: null, addressId: null, reason: "invalid_reference" });
  });

  it("fails closed when the exact address omits registerenhetsreferens", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature({ includeRegisterReference: false })),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toEqual({ point: null, addressId: null, reason: "invalid_reference" });
  });

  it("fails closed when feature.id and properties.objektidentitet disagree", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature({ propertyId: secondAddressId })),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toEqual({ point: null, addressId: null, reason: "invalid_reference" });
  });

  it("requires point geometry for an otherwise exact address", () => {
    expect(diagnoseExactSwerefAddressFromRegisterUnit(
      collection(feature({ geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] } })),
      registerUnitId,
      "11264",
      "Stockholm",
      "Segelbåtsvägen 7A",
    )).toEqual({ point: null, addressId: null, reason: "missing_point" });
  });
});
