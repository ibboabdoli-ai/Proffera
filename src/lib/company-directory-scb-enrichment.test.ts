import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  fetchScbCompanyRegistryEnrichment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./db/server", () => ({ getSql: mocks.getSql }));
vi.mock("./company-directory-scb-provider", () => ({
  fetchScbCompanyRegistryEnrichment: mocks.fetchScbCompanyRegistryEnrichment,
}));

import type { ScbCompanyRegistryEnrichment } from "./company-directory-scb-provider";
import {
  detectScbCompanyDirectoryConflicts,
  enrichCompanyDirectoryScbForProfile,
  officialSniCodes,
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
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.fetchScbCompanyRegistryEnrichment.mockReset();
  });

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

  it("does not flag a long SCB legal name that is clearly truncated mid-name", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Energi och VVS Service VVS-Shopen Svensson & Nyman Aktiebolag",
      bolagsverketSniCodes: [{ code: "43.221" }, { code: "43.229" }],
      scb: scb({
        legalName: "ENERGI OCH VVS SERVICE VVS-SHOPEN SVENSSON & NYM",
        sniCodes: ["43.221", "43.229"],
      }),
    })).toEqual([]);
  });

  it("still flags shorter prefix-like names as real mismatches", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Exempel Elinstallationer Aktiebolag",
      bolagsverketSniCodes: [{ code: "43.210" }],
      scb: scb({ legalName: "Exempel El", sniCodes: ["43.210"] }),
    })).toEqual([
      {
        field: "legal_name",
        code: "legal_name_mismatch",
        bolagsverket: "Exempel Elinstallationer Aktiebolag",
        scb: "Exempel El",
      },
    ]);
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

  it("persists the exact profile and Official Facts snapshot captured before the SCB request", async () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const profileUpdatedToken = "2026-08-19 10:00:00.123456+00";
    const factsLastSyncedToken = "2026-08-19 09:59:00.654321+00";
    const sql = vi.fn()
      .mockResolvedValueOnce([{
        organization_number: "5563115707",
        organization_kind: "juridical_person",
        legal_name: "Exempel El AB",
        profile_updated_token: profileUpdatedToken,
        sni_codes: [{ code: "43.210" }],
        facts_last_synced_token: factsLastSyncedToken,
      }])
      .mockResolvedValueOnce([]);

    mocks.getSql.mockReturnValue(sql);
    mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
      status: "ok",
      data: scb(),
    });

    await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toEqual({
      status: "saved",
      saved: true,
      conflicts: [],
    });

    expect(mocks.fetchScbCompanyRegistryEnrichment).toHaveBeenCalledWith("5563115707", undefined);
    expect(sql).toHaveBeenCalledTimes(2);

    const provenanceValue = sql.mock.calls[1]?.[10];
    expect(JSON.parse(String(provenanceValue))).toMatchObject({
      comparisonSnapshot: {
        profileUpdatedToken,
        officialFactsLastSyncedToken: factsLastSyncedToken,
      },
    });
  });
});
