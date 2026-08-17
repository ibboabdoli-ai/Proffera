import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchScbCompanyRegistryEnrichment,
  getScbCompanyRegistryStatus,
  normalizeScbCompanyRegistryPayload,
} from "./company-directory-scb-provider";

const initialScbCompanyRegistryEnabled = process.env.SCB_COMPANY_REGISTRY_ENABLED;

beforeEach(() => {
  delete process.env.SCB_COMPANY_REGISTRY_ENABLED;
});

afterEach(() => {
  if (initialScbCompanyRegistryEnabled === undefined) {
    delete process.env.SCB_COMPANY_REGISTRY_ENABLED;
  } else {
    process.env.SCB_COMPANY_REGISTRY_ENABLED = initialScbCompanyRegistryEnabled;
  }
});

describe("SCB company registry provider", () => {
  it("stays disabled and never calls the transport by default", async () => {
    const transport = {
      fetchCompany: vi.fn(),
      fetchWorkplaces: vi.fn(),
    };

    await expect(fetchScbCompanyRegistryEnrichment("556311-5707", transport)).resolves.toEqual({
      status: "disabled",
      data: null,
    });
    expect(transport.fetchCompany).not.toHaveBeenCalled();
    expect(transport.fetchWorkplaces).not.toHaveBeenCalled();
  });

  it("fails closed while SCB access details are still pending", async () => {
    process.env.SCB_COMPANY_REGISTRY_ENABLED = "true";

    await expect(fetchScbCompanyRegistryEnrichment("556311-5707")).resolves.toEqual({
      status: "awaiting_access",
      data: null,
    });
    expect(getScbCompanyRegistryStatus()).toEqual({
      enabled: true,
      accessReady: false,
    });
  });

  it("normalizes company and workplace data without mixing the two address concepts", () => {
    const normalized = normalizeScbCompanyRegistryPayload(
      [{
        PeOrgNr: "165563115707",
        Företagsnamn: "Exempel El AB",
        Telefon: "08-123 45 67",
        "E-post": "info@exempel.se",
        Postadress: "BOX 123",
        PostNr: "15122",
        PostOrt: "Södertälje",
        Kommun: "Södertälje",
        "Bransch_1P, kod": "43.210",
      }],
      [{
        OrgNr: "5563115707",
        CfarNr: "12345678",
        Benämning: "Exempel El Södertälje",
        Telefon: "08-765 43 21",
        "E-post": "sodertalje@exempel.se",
        BesöksAdress: "Storgatan 1",
        BesöksPostNr: 15172,
        BesöksPostOrt: "Södertälje",
        Postadress: "Storgatan 1",
        PostNr: "15172",
        PostOrt: "Södertälje",
        Kommun: "Södertälje",
        "SNI-kod": "43210",
      }],
      "556311-5707",
    );

    expect(normalized).toEqual({
      organizationNumber: "5563115707",
      legalName: "Exempel El AB",
      phone: "08-123 45 67",
      email: "info@exempel.se",
      postalAddress: {
        careOf: null,
        addressLine: "BOX 123",
        postalCode: "151 22",
        city: "Södertälje",
      },
      municipality: "Södertälje",
      sniCodes: ["43.210"],
      workplaces: [{
        cfarNumber: "12345678",
        name: "Exempel El Södertälje",
        phone: "08-765 43 21",
        email: "sodertalje@exempel.se",
        visitingAddress: {
          careOf: null,
          addressLine: "Storgatan 1",
          postalCode: "151 72",
          city: "Södertälje",
        },
        postalAddress: {
          careOf: null,
          addressLine: "Storgatan 1",
          postalCode: "151 72",
          city: "Södertälje",
        },
        municipality: "Södertälje",
        sniCodes: ["43.210"],
      }],
      source: "scb_foretagsregistret",
    });
  });

  it("rejects a response that does not uniquely match the requested organization", () => {
    expect(() => normalizeScbCompanyRegistryPayload(
      [{ OrgNr: "5563115707" }, { OrgNr: "5563115707" }],
      [],
      "5563115707",
    )).toThrow("exactly one matching company");

    expect(() => normalizeScbCompanyRegistryPayload(
      [{ OrgNr: "5569999999" }],
      [],
      "5563115707",
    )).toThrow("exactly one matching company");
  });

  it("uses a supplied transport only after the feature is explicitly enabled", async () => {
    process.env.SCB_COMPANY_REGISTRY_ENABLED = "true";
    const transport = {
      fetchCompany: vi.fn().mockResolvedValue([{ OrgNr: "5563115707", Företagsnamn: "Exempel AB" }]),
      fetchWorkplaces: vi.fn().mockResolvedValue([]),
    };

    const result = await fetchScbCompanyRegistryEnrichment("556311-5707", transport);

    expect(result.status).toBe("ok");
    expect(transport.fetchCompany).toHaveBeenCalledWith("5563115707");
    expect(transport.fetchWorkplaces).toHaveBeenCalledWith("5563115707");
    expect(getScbCompanyRegistryStatus(transport)).toEqual({
      enabled: true,
      accessReady: true,
    });
  });
});