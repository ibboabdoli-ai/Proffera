import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyOfficialCompanyCandidate } from "../src/lib/company-directory-source";
import type { NormalizedDirectoryCandidate } from "../src/lib/company-directory-policy";

function discoveredCandidate(overrides: Partial<NormalizedDirectoryCandidate> = {}): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber: "5299999994",
    organizationKind: "juridical_person",
    legalName: "Discovery Name AB",
    displayName: "Discovery Name AB",
    legalForm: "Aktiebolag",
    organizationStatus: "",
    isActive: false,
    fTaxStatus: "",
    vatStatus: "",
    employerStatus: "",
    primarySniCode: "",
    primarySniLabel: "",
    activityDescription: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    municipality: "",
    region: "",
    officialSource: "bolagsverket_vardefulla_datamangder",
    sourceRecordId: "5299999994",
    sourceUpdatedAt: null,
    ...overrides,
  };
}

function officialPayload(options: {
  activeCode?: string;
  deregisteredAt?: string | null;
  organizationForm?: string;
  juridicalForm?: string;
  sni?: Array<{ kod: string; klartext: string }>;
} = {}) {
  return {
    organisationer: [
      {
        organisationsidentitet: { identitetsbeteckning: "5299999994" },
        organisationsnamn: {
          organisationsnamnLista: [{
            registreringsdatum: "2020-03-15",
            namn: "Cykelbolaget AB",
            organisationsnamntyp: { kod: "FORETAGSNAMN", klartext: "Företagsnamn" },
          }],
        },
        registreringsland: { kod: "SE-LAND", klartext: "Sverige" },
        organisationsform: { kod: "AB", klartext: options.organizationForm ?? "Aktiebolag" },
        juridiskForm: { kod: "49", klartext: options.juridicalForm ?? "Övriga aktiebolag" },
        verksamOrganisation: {
          kod: options.activeCode ?? "JA",
          fel: null,
          dataproducent: "SCB",
        },
        postadressOrganisation: {
          postadress: {
            postnummer: "12345",
            utdelningsadress: "Jobbstigen 2",
            land: "Sverige",
            postort: "Grönköping",
          },
          fel: null,
          dataproducent: "SCB",
        },
        verksamhetsbeskrivning: {
          fel: null,
          dataproducent: "Bolagsverket",
          beskrivning: "Bedriva handel med cyklar och tillbehör till cyklar",
        },
        avregistreradOrganisation: {
          avregistreringsdatum: options.deregisteredAt ?? null,
          fel: null,
          dataproducent: "Bolagsverket",
        },
        naringsgrenOrganisation: {
          fel: null,
          dataproducent: "SCB",
          sni: options.sni ?? [{ kod: "47642", klartext: "Specialiserad butikshandel med cyklar" }],
        },
      },
    ],
  };
}

function mockOfficialResponse(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
  process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://example.invalid/organisationer";
  process.env.COMPANY_DIRECTORY_DETAIL_METHOD = "POST";
  process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE = '{"identitetsbeteckning":"{organizationNumber}"}';
  delete process.env.COMPANY_DIRECTORY_TOKEN_URL;
  delete process.env.BOLAGSVERKET_CLIENT_ID;
  delete process.env.BOLAGSVERKET_CLIENT_SECRET;
  delete process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN;
  delete process.env.COMPANY_DIRECTORY_OAUTH_SCOPE;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE;
  delete process.env.COMPANY_DIRECTORY_DETAIL_METHOD;
  delete process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE;
});

describe("official company directory source adapter", () => {
  it("normalizes the documented VärdefullaDatamängder organisation response", async () => {
    mockOfficialResponse(officialPayload());

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.countryCode).toBe("SE");
    expect(result.organizationNumber).toBe("5299999994");
    expect(result.legalName).toBe("Cykelbolaget AB");
    expect(result.legalForm).toBe("Aktiebolag");
    expect(result.primarySniCode).toBe("47.642");
    expect(result.primarySniLabel).toBe("Specialiserad butikshandel med cyklar");
    expect(result.addressLine1).toBe("Jobbstigen 2");
    expect(result.postalCode).toBe("12345");
    expect(result.city).toBe("Grönköping");
    expect(result.activityDescription).toBe("Bedriva handel med cyklar och tillbehör till cyklar");
    expect(result.isActive).toBe(true);
  });

  it("uses organisationsform for classification instead of the broader juridiskForm label", async () => {
    mockOfficialResponse(officialPayload({
      organizationForm: "Handelsbolag",
      juridicalForm: "Bostadsrättsföreningar",
    }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.legalForm).toBe("Handelsbolag");
    expect(result.organizationKind).toBe("juridical_person");
  });

  it("does not treat the wrapper dataproducent as deregistration evidence", async () => {
    mockOfficialResponse(officialPayload({ activeCode: "JA", deregisteredAt: null }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.isActive).toBe(true);
  });

  it("treats an official deregistration date as inactive", async () => {
    mockOfficialResponse(officialPayload({ activeCode: "JA", deregisteredAt: "2023-05-05T00:00:00.000+00:00" }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.isActive).toBe(false);
  });

  it("preserves SCB Ng1 when the matching official SNI is not the first item", async () => {
    mockOfficialResponse(officialPayload({
      sni: [
        { kod: "43210", klartext: "Elinstallationer" },
        { kod: "81210", klartext: "Lokalvård" },
      ],
    }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate({
      primarySniCode: "81.210",
      primarySniLabel: "",
      primarySniVerified: false,
    }));

    expect(result.primarySniCode).toBe("81.210");
    expect(result.primarySniLabel).toBe("Lokalvård");
    expect(result.primarySniVerified).toBe(true);
  });

  it("keeps SCB Ng1 but marks it unverified when the official SNI list does not contain it", async () => {
    mockOfficialResponse(officialPayload({
      sni: [{ kod: "43210", klartext: "Elinstallationer" }],
    }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate({
      primarySniCode: "81.210",
      primarySniLabel: "",
      primarySniVerified: false,
    }));

    expect(result.primarySniCode).toBe("81.210");
    expect(result.primarySniLabel).toBe("");
    expect(result.primarySniVerified).toBe(false);
  });

  it("does not guess a primary SNI for a legacy discovery queue row", async () => {
    mockOfficialResponse(officialPayload({
      sni: [{ kod: "43210", klartext: "Elinstallationer" }],
    }));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate({
      primarySniCode: "",
      primarySniVerified: false,
    }));

    expect(result.primarySniCode).toBe("");
    expect(result.primarySniLabel).toBe("");
    expect(result.primarySniVerified).toBe(false);
  });

  it("rejects a verification response for a different organisation number", async () => {
    const payload = officialPayload();
    payload.organisationer[0].organisationsidentitet.identitetsbeteckning = "5599999999";
    mockOfficialResponse(payload);

    await expect(verifyOfficialCompanyCandidate(discoveredCandidate()))
      .rejects.toThrow("no matching organization identity");
  });
});
