import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchScbAfrV1PreviewEvidence,
  scbAfrV1PreviewAccessReady,
} from "./company-directory-scb-afr-v1";

const keys = ["VERCEL_ENV", "SCB_COMPANY_REGISTRY_AFR_V1_PREVIEW_ENABLED", "SCB_COMPANY_REGISTRY_API_KEY"] as const;
const originals = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

const company = {
  peOrgNr: "165563115707",
  orgNr: "5563115707",
  namn: "Exempel El AB",
  aeAnt: 1,
  kommunSate: "0181",
  postAdress: { gatuAdress: "Box 5", coAdress: "c/o Reception", postNr: "15122", postOrt: "Södertälje" },
  naringsgrenar: [{ rangordning: 1, naringsgren: "43210" }],
  tel: "should-not-project",
  epost: "private@example.test",
};
const workplace = {
  peOrgNr: "165563115707",
  cfarNr: 12345678,
  aeStat: 1,
  aeTyp: 1,
  ben: "Exempel El Södertälje",
  postAdress: { gatuAdress: "Box 5", postNr: "15122", postOrt: "Södertälje" },
  belagenhetsadress: { bGatuAdress: "Storgatan 1", bPostNr: "15172", bPostOrt: "Södertälje", kommun: "0181" },
  geografiskInformation: { nordKoordinatSW: 6567000, ostKoordinatSW: 668000 },
  naringsgrenar: [{ rangordning: 1, naringsgren: "43210" }],
  tel: "private-phone",
  epost: "private-workplace@example.test",
};

function http(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

function fetcher(companyPayload: unknown = company, workplacePayload: unknown = workplace) {
  return vi.fn()
    .mockResolvedValueOnce(http(companyPayload))
    .mockResolvedValueOnce(http(workplacePayload)) as unknown as typeof fetch;
}

beforeEach(() => {
  for (const key of keys) delete process.env[key];
  process.env.VERCEL_ENV = "preview";
  process.env.SCB_COMPANY_REGISTRY_AFR_V1_PREVIEW_ENABLED = "true";
  process.env.SCB_COMPANY_REGISTRY_API_KEY = "fixture-secret";
});

afterEach(() => {
  for (const key of keys) {
    const value = originals[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("SCB AFR v1 Preview-only verification", () => {
  it("fails closed outside Preview, without the explicit toggle, or without credentials", async () => {
    for (const [name, value] of [
      ["VERCEL_ENV", "production"],
      ["SCB_COMPANY_REGISTRY_AFR_V1_PREVIEW_ENABLED", "false"],
      ["SCB_COMPANY_REGISTRY_API_KEY", ""],
    ]) {
      const prior = process.env[name];
      process.env[name] = value;
      expect(scbAfrV1PreviewAccessReady()).toBe(false);
      const mock = vi.fn();
      await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock as typeof fetch }))
        .rejects.toThrow("Preview access is disabled");
      expect(mock).not.toHaveBeenCalled();
      process.env[name] = prior;
    }
  });

  it("uses official GET detail endpoints, private X-API-Key and bounded verified CFAR evidence", async () => {
    const mock = fetcher();
    const data = await fetchScbAfrV1PreviewEvidence("556311-5707", ["12345678"], { fetcher: mock });
    expect(data.organizationNumber).toBe("5563115707");
    expect(data.legalName).toBe("Exempel El AB");
    expect(data.municipality).toBe("Södertälje");
    expect(data.postalAddress).toEqual({ careOf: "c/o Reception", addressLine: "Box 5", postalCode: "151 22", city: "Södertälje" });
    expect(data.sniCodes).toEqual(["43.210"]);
    expect(data.workplaces).toHaveLength(1);
    expect(data.workplaces[0].visitingAddress).toEqual({ careOf: null, addressLine: "Storgatan 1", postalCode: "151 72", city: "Södertälje" });
    expect(data.workplaces[0].coordinates).toEqual({ northing: 6567000, easting: 668000, crs: "SWEREF99" });
    expect(data.phone).toBeNull();
    expect(data.email).toBeNull();
    expect(data.workplaces[0].phone).toBeNull();
    expect(data.workplaces[0].email).toBeNull();
    expect(mock).toHaveBeenCalledTimes(2);
    const [companyUrl, companyOptions] = (mock as ReturnType<typeof vi.fn>).mock.calls[0];
    const [aeUrl, aeOptions] = (mock as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(String(companyUrl)).toBe("https://apiafr.scb.se/v1/juridiskaenheter/165563115707/full");
    expect(String(aeUrl)).toBe("https://apiafr.scb.se/v1/arbetsstallen/12345678/full");
    expect(companyOptions.headers).toEqual({ "X-API-Key": "fixture-secret", Accept: "application/json" });
    expect(aeOptions.cache).toBe("no-store");
    expect(aeOptions.redirect).toBe("error");
  });

  it("rejects missing or duplicate CFAR evidence before network access", async () => {
    const mock = vi.fn();
    for (const ids of [[], ["12345678", "12345678"], ["invalid"], Array(26).fill("12345678")]) {
      await expect(fetchScbAfrV1PreviewEvidence("5563115707", ids, { fetcher: mock as typeof fetch }))
        .rejects.toThrow();
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it("rejects incomplete AE coverage before fetching any workplaces", async () => {
    const mock = vi.fn().mockResolvedValueOnce(http({ ...company, aeAnt: 2 }));
    await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock as typeof fetch }))
      .rejects.toThrow("does not cover all company workplaces");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-company, wrong CFAR and inactive AE payloads", async () => {
    for (const ae of [
      { ...workplace, peOrgNr: "165569999999" },
      { ...workplace, cfarNr: 87654321 },
      { ...workplace, aeStat: 9 },
    ]) {
      await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: fetcher(company, ae) }))
        .rejects.toThrow();
    }
  });

  it("rejects SCB fictitious and unclassified AE types before normalizing a physical location", async () => {
    for (const aeTyp of [3, 0, 9, undefined]) {
      const ae = { ...workplace, aeTyp };
      const mock = fetcher(company, ae);
      await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock }))
        .rejects.toThrow("workplace type is not a physical workplace");
      expect(mock).toHaveBeenCalledTimes(2);
    }
  });

  it("accepts an active, physical type-2 workplace without claiming it represents the legal entity", async () => {
    const data = await fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], {
      fetcher: fetcher(company, { ...workplace, aeTyp: 2 }),
    });
    expect(data.workplaces).toHaveLength(1);
    expect(data.workplaces[0].visitingAddress.addressLine).toBe("Storgatan 1");
  });

  it("rejects an incorrect legal-entity identity and malformed company content", async () => {
    for (const je of [{ ...company, orgNr: "5569999999" }, { ...company, namn: null }]) {
      const mock = vi.fn().mockResolvedValueOnce(http(je));
      await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock as typeof fetch }))
        .rejects.toThrow();
    }
  });

  it("does not expose the API key in error messages", async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response("error", { status: 429 }));
    await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock as typeof fetch }))
      .rejects.toThrow("HTTP 429");
  });

  it("rejects oversized responses before parsing JSON", async () => {
    const mock = vi.fn().mockResolvedValueOnce(http({ huge: "a".repeat(262144) }));
    await expect(fetchScbAfrV1PreviewEvidence("5563115707", ["12345678"], { fetcher: mock as typeof fetch }))
      .rejects.toThrow("exceeded size limit");
  });
});
