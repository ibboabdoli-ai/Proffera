import { describe, expect, it } from "vitest";

import { resolveCompanyDirectoryPublicAddress } from "@/lib/company-directory-scb-address";

const profile = {
  addressLine1: "Bohusgatan 47 I",
  postalCode: "11667",
  city: "STOCKHOLM",
  municipality: "Stockholm",
};

describe("Company Directory SCB public address resolution", () => {
  it("uses the complete visiting address for a true single-workplace company instead of a company PO box", () => {
    const resolved = resolveCompanyDirectoryPublicAddress(profile, [{
      municipality: "Stockholm",
      visitingAddress: {
        addressLine: "BOHUSGATAN 47",
        postalCode: "116 67",
        city: "STOCKHOLM",
      },
      postalAddress: {
        addressLine: "BOX 11194",
        postalCode: "100 61",
        city: "STOCKHOLM",
      },
    }]);

    expect(resolved).toEqual({
      addressLine1: "BOHUSGATAN 47",
      postalCode: "116 67",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    });
  });

  it("updates street, postal code and city as one coherent visiting-address bundle", () => {
    const resolved = resolveCompanyDirectoryPublicAddress({
      addressLine1: "Alsnögatan 18",
      postalCode: "11641",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    }, [{
      municipality: "Stockholm",
      visitingAddress: {
        addressLine: "ALSNÖGATAN 18 LGH 1503",
        postalCode: "11647",
        city: "STOCKHOLM",
      },
    }]);

    expect(resolved).toEqual({
      addressLine1: "ALSNÖGATAN 18 LGH 1503",
      postalCode: "116 47",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    });
  });

  it("selects the one matching visiting address for a multi-workplace company", () => {
    const resolved = resolveCompanyDirectoryPublicAddress({
      addressLine1: "Strandbergsgatan 55",
      postalCode: "11251",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    }, [
      {
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "STRANDBERGSGATAN 55",
          postalCode: "112 51",
          city: "STOCKHOLM",
        },
      },
      {
        municipality: "Göteborg",
        visitingAddress: {
          addressLine: "Andra gatan 2",
          postalCode: "411 01",
          city: "GÖTEBORG",
        },
      },
    ]);

    expect(resolved.addressLine1).toBe("STRANDBERGSGATAN 55");
    expect(resolved.postalCode).toBe("112 51");
  });

  it("keeps the profile fallback when multiple workplaces are ambiguous", () => {
    const fallback = {
      addressLine1: "Box 24153",
      postalCode: "10451",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, [
      {
        municipality: "Solna",
        visitingAddress: {
          addressLine: "Dalvägen 22",
          postalCode: "169 79",
          city: "SOLNA",
        },
      },
      {
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "Kungsgatan 1",
          postalCode: "111 43",
          city: "STOCKHOLM",
        },
      },
    ]);

    expect(resolved).toEqual(fallback);
  });

  it("does not treat one complete address as single-workplace when other workplaces are incomplete", () => {
    const fallback = {
      addressLine1: "Box 10",
      postalCode: "10010",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, [
      {
        municipality: "Solna",
        visitingAddress: {
          addressLine: "Dalvägen 22",
          postalCode: "169 79",
          city: "SOLNA",
        },
      },
      {
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "Okändgatan 2",
          postalCode: "",
          city: "STOCKHOLM",
        },
      },
    ]);

    expect(resolved).toEqual(fallback);
  });

  it("does not match only by postal code when a multi-workplace profile city is missing", () => {
    const fallback = {
      addressLine1: "Box 10",
      postalCode: "16979",
      city: "",
      municipality: "Stockholm",
    };
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, [
      {
        municipality: "Solna",
        visitingAddress: {
          addressLine: "Dalvägen 22",
          postalCode: "169 79",
          city: "SOLNA",
        },
      },
      {
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "Annan väg 5",
          postalCode: "111 43",
          city: "STOCKHOLM",
        },
      },
    ]);

    expect(resolved).toEqual(fallback);
  });

  it("keeps the profile fallback when a workplace municipality is missing", () => {
    const fallback = {
      addressLine1: "Gamla vägen 1",
      postalCode: "11111",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, [{
      visitingAddress: {
        addressLine: "NYA VÄGEN 2",
        postalCode: "16979",
        city: "SOLNA",
      },
    }]);

    expect(resolved).toEqual(fallback);
  });
});
