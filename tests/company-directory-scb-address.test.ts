import { describe, expect, it } from "vitest";

import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  resolveCompanyDirectoryPublicAddress,
  resolveCompanyDirectoryPublicAddressResolution,
} from "@/lib/company-directory-scb-address";

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
    const input = {
      addressLine1: "Strandbergsgatan 55",
      postalCode: "11251",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const workplaces = [
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
    ];
    const resolved = resolveCompanyDirectoryPublicAddress(input, workplaces);
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(input, workplaces);

    expect(resolved.addressLine1).toBe("STRANDBERGSGATAN 55");
    expect(resolved.postalCode).toBe("112 51");
    expect(canonical).toEqual({
      status: "resolved",
      address: {
        addressLine1: "STRANDBERGSGATAN 55",
        postalCode: "112 51",
        city: "STOCKHOLM",
        municipality: "Stockholm",
      },
      sourceIndex: 0,
    });
  });

  it("keeps the legacy profile fallback but marks physical location unavailable when multiple workplaces are ambiguous", () => {
    const fallback = {
      addressLine1: "Box 24153",
      postalCode: "10451",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const workplaces = [
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
    ];
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, workplaces);
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(fallback, workplaces);

    expect(resolved).toEqual(fallback);
    expect(canonical).toEqual({
      status: "unavailable",
      reason: "ambiguous_workplaces",
      address: null,
      sourceIndex: null,
    });
  });

  it("does not treat one complete address as single-workplace when other workplaces are incomplete", () => {
    const fallback = {
      addressLine1: "Box 10",
      postalCode: "10010",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const workplaces = [
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
    ];
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, workplaces);
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(fallback, workplaces);

    expect(resolved).toEqual(fallback);
    expect(canonical.status).toBe("unavailable");
    if (canonical.status === "unavailable") {
      expect(canonical.reason).toBe("ambiguous_workplaces");
    }
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

  it("keeps the legacy profile fallback but marks physical location unavailable when workplace municipality is missing", () => {
    const fallback = {
      addressLine1: "Gamla vägen 1",
      postalCode: "11111",
      city: "STOCKHOLM",
      municipality: "Stockholm",
    };
    const workplaces = [{
      visitingAddress: {
        addressLine: "NYA VÄGEN 2",
        postalCode: "16979",
        city: "SOLNA",
      },
    }];
    const resolved = resolveCompanyDirectoryPublicAddress(fallback, workplaces);
    const resolution = resolveCompanyDirectoryPublicAddressResolution(fallback, workplaces);
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(fallback, workplaces);

    expect(resolved).toEqual(fallback);
    expect(resolution.source).toBe("profile");
    expect(resolution.sourceIndex).toBeNull();
    expect(resolution.address).toEqual(fallback);
    expect(canonical).toEqual({
      status: "unavailable",
      reason: "no_complete_workplace",
      address: null,
      sourceIndex: null,
    });
  });

  it("marks physical location unavailable when the visiting address is missing", () => {
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(profile, [{
      municipality: "Stockholm",
      postalAddress: {
        addressLine: "BOX 11194",
        postalCode: "100 61",
        city: "STOCKHOLM",
      },
    }]);

    expect(canonical).toEqual({
      status: "unavailable",
      reason: "no_complete_workplace",
      address: null,
      sourceIndex: null,
    });
  });

  it("marks physical location unavailable when SCB has no workplaces", () => {
    const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(profile, []);

    expect(canonical).toEqual({
      status: "unavailable",
      reason: "no_workplaces",
      address: null,
      sourceIndex: null,
    });
  });
});
