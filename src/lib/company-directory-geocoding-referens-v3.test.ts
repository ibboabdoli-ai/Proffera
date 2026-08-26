import { describe, expect, it } from "vitest";

import {
  resolveDirectoryGeocodingApiBases,
  selectDirectoryAddressReferenceCandidates,
  selectUniqueDirectoryAddressReference,
} from "./company-directory-geocoding";

const referenceId = "439b33bf-6279-4b65-b32c-9741646d8d3e";

describe("Referens Uppslag Adress v3 response compatibility", () => {
  it("accepts postcode and postort from the v3 structured adress object", () => {
    const references = [{
      objektidentitet: referenceId,
      adress: {
        kommun: "Stockholm",
        adressområde: "Segelbåtsvägen",
        adressplatsnummer: 7,
        bokstavstillägg: "A",
        postnummer: 11264,
        postort: "Stockholm",
      },
    }];

    expect(selectDirectoryAddressReferenceCandidates(references, "112 64", "STOCKHOLM"))
      .toEqual(references);
    expect(selectUniqueDirectoryAddressReference(references, "11264", "Stockholm")?.objektidentitet)
      .toBe(referenceId);
  });

  it("keeps a v3 label-only result for authoritative detail verification", () => {
    const references = [{
      objektidentitet: referenceId,
      adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
    }];

    expect(selectDirectoryAddressReferenceCandidates(references, "112 64", "Stockholm"))
      .toEqual(references);
  });
});

describe("Directory Lantmäteriet API environment alignment", () => {
  it("derives the api-ver lookup base when only an api-ver detail base is configured", () => {
    expect(resolveDirectoryGeocodingApiBases({
      detailBaseUrl: "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
    })).toEqual({
      accepted: true,
      detailBaseUrl: "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
      lookupBaseUrl: "https://api-ver.lantmateriet.se/distribution/produkter/uppslag/adress/v3",
    });
  });

  it("rejects an explicit lookup URL from a different Lantmäteriet environment", () => {
    expect(resolveDirectoryGeocodingApiBases({
      detailBaseUrl: "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
      lookupBaseUrl: "https://api.lantmateriet.se/distribution/produkter/uppslag/adress/v3",
    }).accepted).toBe(false);
  });
});
