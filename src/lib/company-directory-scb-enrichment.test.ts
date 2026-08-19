import { describe, expect, it } from "vitest";

import type { ScbCompanyRegistryEnrichment } from "./company-directory-scb-provider";
import {
  detectScbCompanyDirectoryConflicts,
  officialSniCodes,
  scbComparisonSnapshotMatches,
} from "./company-directory-scb-enrichment";

function scb(overrides: Partial<ScbCompanyRegistryEnrichment> = {}): ScbCompanyRegistryEnrichment {
  return {
    organizationNumber: "5563115707",
    legalName: "Exempel El AB",
    phone: null,
    email: null,
    postalAddress: {
      careOf: null,
      addressLine: null,
      postalCode: null,
      city: null,
    },
    municipality: null,
    sniCodes: ["43.210"],
    workplaces: [],
    source: "scb_foretagsregistret",
    provenance: {
      legalName: "scb_foretagsregistret",
      phone: "scb_foretagsregistret",
      email: "scb_foretagsregistret",
      postalAddress: "scb_foretagsregistret",
      municipality: "scb_foretagsregistret",
      sniCodes: "scb_foretagsregistret",
      workplaces: "scb_foretagsregistret",
    },
    ...overrides,
  };
}

describe("SCB company directory enrichment guards", () => {
  it("normalizes Bolagsverket SNI facts without duplicating codes", () => {
    expect(officialSniCodes([
      { code: "43.210", label: "Elinstallationer" },
      { kod: "43210" },
      "62.100",
    ])).toEqual(["43210", "62100"]);
  });

  it("does not flag equivalent legal names or overlapping SNI", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Exempel El AB",
      bolagsverketSniCodes: [{ code: "43.210" }, { code: "71.120" }],
      scb: scb({
        legalName: "EXEMPEL EL AB",
        sniCodes: ["43.210", "95.220"],
      }),
    })).toEqual([]);
  });

  it("preserves legal-name and SNI disagreements as explicit conflicts", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Bolagsverket Namn AB",
      bolagsverketSniCodes: [{ code: "43.210" }],
      scb: scb({
        legalName: "SCB Namn AB",
        sniCodes: ["62.100"],
      }),
    })).toEqual([
      {
        field: "legal_name",
        code: "legal_name_mismatch",
        bolagsverket: "Bolagsverket Namn AB",
        scb: "SCB Namn AB",
      },
      {
        field: "sni_codes",
        code: "sni_no_overlap",
        bolagsverket: ["43210"],
        scb: ["62100"],
      },
    ]);
  });

  it("does not invent a conflict when one source lacks a comparable value", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "",
      bolagsverketSniCodes: [],
      scb: scb({ legalName: "SCB Namn AB", sniCodes: ["62.100"] }),
    })).toEqual([]);
  });

  it("invalidates a captured comparison snapshot when profile or official facts change during enrichment", () => {
    const captured = {
      profileUpdatedToken: "2026-08-19 10:00:00+00",
      officialFactsLastSyncedToken: "2026-08-19 09:59:00+00",
    };

    expect(scbComparisonSnapshotMatches(captured, captured)).toBe(true);
    expect(scbComparisonSnapshotMatches(captured, {
      ...captured,
      profileUpdatedToken: "2026-08-19 10:00:01+00",
    })).toBe(false);
    expect(scbComparisonSnapshotMatches(captured, {
      ...captured,
      officialFactsLastSyncedToken: "2026-08-19 10:00:02+00",
    })).toBe(false);
  });
});
