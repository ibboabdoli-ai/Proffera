import { describe, expect, it } from "vitest";

import {
  DIRECTORY_GEOCODING_DIAGNOSTIC_RETRY_ORGS,
  buildDirectoryAddressSearchText,
  buildDirectoryGeocodingNoMatchSource,
  classifyDirectoryGeocodingBatchError,
  cleanDirectoryStreetAddress,
  diagnoseExactSwerefAddressDetail,
  isDirectoryGeocodingNoMatchSource,
  mapDirectoryGeocodingFetchError,
  parseExactSwerefAddressDetail,
  parseSwerefPointGeometry,
  selectDirectoryAddressReferenceCandidates,
  selectUniqueDirectoryAddressReference,
  shouldRetryLegacyDirectoryNoMatch,
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

  it("limits legacy no-match retry to the three diagnostic pilot companies", () => {
    expect(DIRECTORY_GEOCODING_DIAGNOSTIC_RETRY_ORGS).toEqual([
      "5564208337",
      "5563276806",
      "5565120846",
    ]);
    expect(shouldRetryLegacyDirectoryNoMatch("5564208337", "lantmateriet_no_match_v4_2")).toBe(true);
    expect(shouldRetryLegacyDirectoryNoMatch("5564208337", "lantmateriet_no_match_v4_2:street_mismatch")).toBe(false);
    expect(shouldRetryLegacyDirectoryNoMatch("5562039429", "lantmateriet_no_match_v4_2")).toBe(false);
  });

  it("stores a stable diagnostic reason without losing no-match classification", () => {
    const source = buildDirectoryGeocodingNoMatchSource("street_mismatch");
    expect(source).toBe("lantmateriet_no_match_v4_2:street_mismatch");
    expect(isDirectoryGeocodingNoMatchSource("lantmateriet_no_match_v4_2")).toBe(true);
    expect(isDirectoryGeocodingNoMatchSource(source)).toBe(true);
    expect(isDirectoryGeocodingNoMatchSource("lantmateriet_belagenhetsadress_v4_2")).toBe(false);
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

  it("treats only deadline-bound fetch aborts as deadline termination", () => {
    const timeoutError = new DOMException("Timed out", "TimeoutError");
    const deadlineError = mapDirectoryGeocodingFetchError(timeoutError, true);

    expect(deadlineError).not.toBe(timeoutError);
    expect((deadlineError as Error).name).toBe("GeocodingDeadlineExceeded");
    expect(classifyDirectoryGeocodingBatchError(deadlineError)).toBe("deadline");
    expect(classifyDirectoryGeocodingBatchError(timeoutError)).toBe("error");
    expect(mapDirectoryGeocodingFetchError(timeoutError, false)).toBe(timeoutError);

    const networkError = new Error("network failed");
    expect(mapDirectoryGeocodingFetchError(networkError, true)).toBe(networkError);
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

  it("classifies exact-detail failures instead of collapsing them into generic no-match", () => {
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

    expect(diagnoseExactSwerefAddressDetail(payload, "11264", "Stockholm", "Segelbåtsvägen 7A"))
      .toEqual({ point: { easting: 674000, northing: 6580000 }, reason: null });
    expect(diagnoseExactSwerefAddressDetail(payload, "11738", "Stockholm", "Segelbåtsvägen 7A").reason)
      .toBe("postal_mismatch");
    expect(diagnoseExactSwerefAddressDetail(payload, "11264", "Stockholm", "Annan gata 7A").reason)
      .toBe("street_mismatch");
    expect(diagnoseExactSwerefAddressDetail({
      ...payload,
      features: [{
        ...payload.features[0],
        geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] },
      }],
    }, "11264", "Stockholm", "Segelbåtsvägen 7A").reason).toBe("missing_point");
    expect(diagnoseExactSwerefAddressDetail({}, "11264", "Stockholm", "Segelbåtsvägen 7A").reason)
      .toBe("unexpected_detail_response");
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
