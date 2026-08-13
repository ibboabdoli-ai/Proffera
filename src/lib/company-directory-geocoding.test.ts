import { describe, expect, it } from "vitest";

import {
  cleanDirectoryStreetAddress,
  parseSwerefPointGeometry,
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

  it("rejects ambiguous or wrong-postcode references", () => {
    const samePlace = {
      adressComponents: { postnummer: 11264, postort: "Stockholm" },
    };
    expect(selectUniqueDirectoryAddressReference([
      { ...samePlace, objektidentitet: "11111111-1111-4111-8111-111111111111" },
      { ...samePlace, objektidentitet: "22222222-2222-4222-8222-222222222222" },
    ], "11264", "Stockholm")).toBeNull();

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
});
