import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyOfficialCompanyCandidate } from "../src/lib/company-directory-source";
import type { NormalizedDirectoryCandidate } from "../src/lib/company-directory-policy";

function discoveredCandidate(): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber: "5591234567",
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
    sourceRecordId: "5591234567",
    sourceUpdatedAt: null,
  };
}

function officialPayload(registration: boolean | string) {
  return {
    organisationer: [
      {
        organisationsidentitet: { identitetsbeteckning: "5591234567" },
        organisationsnamn: {
          organisationsnamnLista: [{ organisationsnamn: "Exempel Städ AB" }],
        },
        juridiskForm: { klartext: "Aktiebolag" },
        verksamOrganisation: {
          fSkatt: registration,
          momsregistrerad: false,
          arbetsgivarregistrerad: false,
        },
        naringsgrenOrganisation: {
          naringsgrenLista: [{ kod: "81210", klartext: "Lokalvård" }],
        },
        postadressOrganisation: {
          postadress: {
            utdelningsadress1: "Exempelvägen 1",
            postnummer: "15100",
            postort: "Södertälje",
          },
        },
        verksamhetsbeskrivning: {
          verksamhetsbeskrivning: "Lokalvård för företag och hushåll.",
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
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE;
  delete process.env.COMPANY_DIRECTORY_DETAIL_METHOD;
  delete process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE;
});

describe("official company directory source adapter", () => {
  it("normalizes the nested organisation response conservatively", async () => {
    mockOfficialResponse(officialPayload(true));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.organizationNumber).toBe("5591234567");
    expect(result.legalName).toBe("Exempel Städ AB");
    expect(result.legalForm).toBe("Aktiebolag");
    expect(result.primarySniCode).toBe("81.210");
    expect(result.primarySniLabel).toBe("Lokalvård");
    expect(result.addressLine1).toBe("Exempelvägen 1");
    expect(result.postalCode).toBe("15100");
    expect(result.city).toBe("Södertälje");
    expect(result.activityDescription).toBe("Lokalvård för företag och hushåll.");
    expect(result.fTaxStatus).toBe("Registrerad");
    expect(result.isActive).toBe(true);
  });

  it("does not treat 'Ej registrerad' as proof that the organisation is active", async () => {
    mockOfficialResponse(officialPayload("Ej registrerad"));

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result.fTaxStatus).toBe("Ej registrerad");
    expect(result.isActive).toBe(false);
  });

  it("rejects a verification response for a different organisation number", async () => {
    const payload = officialPayload(true);
    payload.organisationer[0].organisationsidentitet.identitetsbeteckning = "5599999999";
    mockOfficialResponse(payload);

    await expect(verifyOfficialCompanyCandidate(discoveredCandidate()))
      .rejects.toThrow("different organization number");
  });
});
