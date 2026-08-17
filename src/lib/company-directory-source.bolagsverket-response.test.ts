import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NormalizedDirectoryCandidate } from "./company-directory-policy";
import { verifyOfficialCompanyCandidate } from "./company-directory-source";

const ENV_KEYS = [
  "COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE",
  "COMPANY_DIRECTORY_DETAIL_METHOD",
  "COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE",
  "COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN",
] as const;

const initialEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    initialEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = initialEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  initialEnv.clear();
  vi.unstubAllGlobals();
});

function discoveredCandidate(): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber: "5299999994",
    organizationKind: "juridical_person",
    legalName: "Discovery name",
    displayName: "Discovery name",
    legalForm: "Aktiebolag",
    organizationStatus: "Registrerad",
    isActive: true,
    fTaxStatus: "",
    vatStatus: "",
    employerStatus: "",
    primarySniCode: "",
    primarySniLabel: "",
    activityDescription: "",
    addressLine1: "Discovery address",
    postalCode: "00000",
    city: "Discovery city",
    municipality: "Stockholm",
    region: "Stockholm",
    officialSource: "bolagsverket_vardefulla_datamangder",
    sourceRecordId: "5299999994",
    sourceUpdatedAt: null,
  };
}

const officialAktiebolagResponse = {
  organisationer: [{
    organisationsidentitet: {
      identitetsbeteckning: "5299999994",
      typ: { kod: "ORGNR", klartext: "Organisationsnummer" },
    },
    namnskyddslopnummer: null,
    organisationsnamn: {
      organisationsnamnLista: [{
        registreringsdatum: "2020-03-15",
        namn: "Cykelbolaget AB",
        organisationsnamntyp: { kod: "FORETAGSNAMN", klartext: "Företagsnamn" },
        verksamhetsbeskrivningSarskiltForetagsnamn: null,
      }],
      fel: null,
      dataproducent: "Bolagsverket",
    },
    registreringsland: { kod: "SE-LAND", klartext: "Sverige" },
    organisationsform: {
      kod: "AB",
      klartext: "Aktiebolag",
      fel: null,
      dataproducent: "Bolagsverket",
    },
    reklamsparr: { kod: "JA", fel: null, dataproducent: "SCB" },
    juridiskForm: {
      kod: "49",
      klartext: "Övriga aktiebolag",
      fel: null,
      dataproducent: "SCB",
    },
    verksamOrganisation: { kod: "NEJ", fel: null, dataproducent: "SCB" },
    postadressOrganisation: {
      postadress: {
        postnummer: "12345",
        utdelningsadress: "Jobbstigen 2",
        land: "Sverige",
        coAdress: "C/o Annat företag",
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
    organisationsdatum: {
      registreringsdatum: "2000-01-23",
      fel: null,
      dataproducent: "Bolagsverket",
      infortHosScb: "2000-02-03",
    },
    avregistreradOrganisation: {
      avregistreringsdatum: "2023-05-05T00:00:00.000+00:00",
      fel: null,
      dataproducent: "Bolagsverket",
    },
    naringsgrenOrganisation: {
      fel: null,
      dataproducent: "Bolagsverket",
      sni: [
        { kod: "47642", klartext: "Specialiserad butikshandel med cyklar" },
        { kod: "45400", klartext: "EU-mopeder, reservdelar och tillbehör, handel med" },
      ],
    },
  }],
};

describe("Bolagsverket official /organisationer response", () => {
  it("normalizes the official aktiebolag response through the real verification path", async () => {
    process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE =
      "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer";
    process.env.COMPANY_DIRECTORY_DETAIL_METHOD = "POST";
    process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN = "test-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => officialAktiebolagResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOfficialCompanyCandidate(discoveredCandidate());

    expect(result).toMatchObject({
      countryCode: "SE",
      organizationNumber: "5299999994",
      organizationKind: "juridical_person",
      legalName: "Cykelbolaget AB",
      displayName: "Cykelbolaget AB",
      legalForm: "Aktiebolag",
      isActive: false,
      primarySniCode: "47.642",
      primarySniLabel: "Specialiserad butikshandel med cyklar",
      activityDescription: "Bedriva handel med cyklar och tillbehör till cyklar",
      addressLine1: "Jobbstigen 2",
      postalCode: "12345",
      city: "Grönköping",
      municipality: "Stockholm",
      region: "Stockholm",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ identitetsbeteckning: "5299999994" }),
      cache: "no-store",
    });
    expect(init.headers).toMatchObject({
      accept: "application/json",
      "content-type": "application/json",
      authorization: "Bearer test-token",
    });
    expect(init.headers["x-request-id"]).toEqual(expect.any(String));
  });
});
