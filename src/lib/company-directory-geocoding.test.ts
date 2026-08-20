import { describe, expect, it } from "vitest";

import {
  buildDirectoryAddressSearchText,
  cleanDirectoryStreetAddress,
  parseExactSwerefAddressDetail,
  parseSwerefPointGeometry,
  selectDirectoryAddressReferenceCandidates,
  selectUniqueDirectoryAddressReference,
} from "./company-directory-geocoding";

describe("company directory geocoding helpers", () => {
  it("removes floor and apartment suffixes only from the lookup copy", () => {
    expect(cleanDirectoryStreetAddress("Fatburs Brunnsgata 13, 3tr")).toBe("Fatburs Brunnsgata 13");
    expect(cleanDirectoryStreetAddress("Vänskapsvägen 45, nb")).toBe("Vänskapsvägen 45");
    expect(cleanDirectoryStreetAddress("Sveavägen 82 Läg nr 1601")).toBe("Sveavägen 82");
    expect(cleanDirectoryStreetAddress("Drakenbergsgatan 53, 1702")).toBe("Drakenbergsgatan 53");
    expect(cleanDirectoryStreetAddress("Segelbåtsvägen 7")).toBe("Segelbåtsvägen 7");
  });

  it("searches Lantmäteriet with belägenhetsadress text, not a postal address", () => {
    expect(buildDirectoryAddressSearchText("Segelbåtsvägen 7", "STOCKHOLM"))
      .toBe("Segelbåtsvägen 7, STOCKHOLM");
  });

  it("selects only one reference with exact postcode and postort", () => {
    const reference = selectUniqueDirectoryAddressReference([
      {
        objektidentitet: "439b33bf-6279-4b65-b32c-9741646d8d3e",
        adress: "Segelbåtsvägen 7, 112 64 Stockholm",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      },
      {
        objektidentitet: "11111111-1111-4111-8111-111111111111",
        adress: "Segelbåtsvägen 7, 999 99 Annanstans",
        adressComponents: { postnummer: 99999, postort: "Annanstans" },
      },
    ], "112 64", "STOCKHOLM");

    expect(reference?.objektidentitet).toBe("439b33bf-6279-4b65-b32c-9741646d8d3e");
  });

  it("keeps references with missing optional postal components for detail verification", () => {
    const candidates = selectDirectoryAddressReferenceCandidates([
      {
        objektidentitet: "439b33bf-6279-4b65-b32c-9741646d8d3e",
        adress: "Segelbåtsvägen 7 Stockholm",
        adressComponents: {},
      },
      {
        objektidentitet: "11111111-1111-4111-8111-111111111111",
        adress: "Segelbåtsvägen 7 Annanstans",
        adressComponents: { postnummer: 99999, postort: "Annanstans" },
      },
    ], "112 64", "STOCKHOLM");

    expect(candidates.map((candidate) => candidate.objektidentitet)).toEqual([
      "439b33bf-6279-4b65-b32c-9741646d8d3e",
    ]);
  });

  it("keeps exact and missing-postal candidates until authoritative street verification", () => {
    const candidates = selectDirectoryAddressReferenceCandidates([
      {
        objektidentitet: "11111111-1111-4111-8111-111111111111",
        adress: "Felgatan 7, 112 64 Stockholm",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      },
      {
        objektidentitet: "22222222-2222-4222-8222-222222222222",
        adress: "Segelbåtsvägen 7 Stockholm",
        adressComponents: {},
      },
    ], "11264", "Stockholm");

    expect(candidates.map((candidate) => candidate.objektidentitet)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("rejects malformed UUIDs before detail lookup", () => {
    expect(selectDirectoryAddressReferenceCandidates([
      {
        objektidentitet: "------------------------------------",
        adress: "Segelbåtsvägen 7 Stockholm",
        adressComponents: {},
      },
      {
        objektidentitet: "not-a-uuid",
        adress: "Segelbåtsvägen 7 Stockholm",
        adressComponents: {},
      },
    ], "11264", "Stockholm")).toEqual([]);
  });

  it("keeps ambiguous postal candidates for exact street detail verification", () => {
    const samePlace = {
      adressComponents: { postnummer: 11264, postort: "Stockholm" },
    };
    expect(selectUniqueDirectoryAddressReference([
      { ...samePlace, objektidentitet: "11111111-1111-4111-8111-111111111111" },
      { ...samePlace, objektidentitet: "22222222-2222-4222-8222-222222222222" },
    ], "11264", "Stockholm")).toBeNull();

    expect(selectDirectoryAddressReferenceCandidates([
      { ...samePlace, objektidentitet: "11111111-1111-4111-8111-111111111111" },
      { ...samePlace, objektidentitet: "22222222-2222-4222-8222-222222222222" },
    ], "11264", "Stockholm").map((candidate) => candidate.objektidentitet)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);

    expect(selectUniqueDirectoryAddressReference([
      {
        objektidentitet: "33333333-3333-4333-8333-333333333333",
        adressComponents: { postnummer: 11738, postort: "Stockholm" },
      },
    ], "11264", "Stockholm")).toBeNull();
  });

  it("parses exactly one SWEREF point geometry", () => {
    expect(parseSwerefPointGeometry({
      type: "FeatureCollection",
      features: [{ geometry: { type: "Point", coordinates: [674000, 6580000] } }],
    })).toEqual({ easting: 674000, northing: 6580000 });

    expect(parseSwerefPointGeometry({
      features: [{ geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] } }],
    })).toBeNull();
    expect(parseSwerefPointGeometry({ features: [] })).toBeNull();
  });

  it("accepts detail geometry only after exact official street, postcode and postort verification", () => {
    const payload = {
      type: "FeatureCollection",
      features: [{
        geometry: { type: "Point", coordinates: [674000, 6580000] },
        properties: {
          adressplatsattribut: {
            postnummer: 11264,
            postort: "Stockholm",
            adressplatsbeteckning: {
              adressplatsnummer: "7",
              bokstavstillagg: "A",
            },
          },
          adressomrade: { faststalltNamn: "Segelbåtsvägen" },
        },
      }],
    };

    expect(parseExactSwerefAddressDetail(payload, "112 64", "STOCKHOLM", "Segelbåtsvägen 7 A"))
      .toEqual({ easting: 674000, northing: 6580000 });
    expect(parseExactSwerefAddressDetail(payload, "11738", "Stockholm", "Segelbåtsvägen 7A")).toBeNull();
    expect(parseExactSwerefAddressDetail(payload, "11264", "Göteborg", "Segelbåtsvägen 7A")).toBeNull();
    expect(parseExactSwerefAddressDetail(payload, "11264", "Stockholm", "Annan gata 7A")).toBeNull();
    expect(parseExactSwerefAddressDetail(payload, "11264", "Stockholm", "Segelbåtsvägen 8A")).toBeNull();
  });
});
