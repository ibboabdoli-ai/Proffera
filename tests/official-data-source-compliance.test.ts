import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bolagsverketMinimumIntervalMs,
  canQueryBolagsverketCompanyDetail,
  requireBolagsverketHttpsUrl,
} from "../src/lib/bolagsverket-api-policy";
import { directoryCopy } from "../src/components/company-directory/public-directory-copy";
import { directoryProfileCopy } from "../src/components/company-directory/public-directory-profile-copy";
import {
  fetchOfficialCompanyDirectoryBatch,
  verifyOfficialCompanyCandidate,
} from "../src/lib/company-directory-source";
import type { NormalizedDirectoryCandidate } from "../src/lib/company-directory-policy";

const ENV_KEYS = [
  "COMPANY_DIRECTORY_SOURCE_URL",
  "COMPANY_DIRECTORY_PROVIDER",
  "COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN",
  "COMPANY_DIRECTORY_TOKEN_URL",
  "COMPANY_DIRECTORY_OAUTH_SCOPE",
  "BOLAGSVERKET_CLIENT_ID",
  "BOLAGSVERKET_CLIENT_SECRET",
  "COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE",
  "COMPANY_DIRECTORY_DETAIL_METHOD",
  "COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function candidate(overrides: Partial<NormalizedDirectoryCandidate> = {}): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber: "5590026307",
    organizationKind: "juridical_person",
    legalName: "Example AB",
    displayName: "Example AB",
    legalForm: "Aktiebolag",
    organizationStatus: "Registrerad",
    isActive: true,
    fTaxStatus: "Registrerad",
    vatStatus: "Registrerad",
    employerStatus: "Registrerad",
    primarySniCode: "43.210",
    primarySniLabel: "Elinstallationer",
    activityDescription: "",
    addressLine1: "",
    postalCode: "",
    city: "Södertälje",
    municipality: "Södertälje",
    region: "Stockholm",
    officialSource: "bolagsverket_vardefulla_datamangder",
    sourceRecordId: "5590026307",
    sourceUpdatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("official data source compliance", () => {
  it("uses conservative Bolagsverket request spacing for both API families", () => {
    expect(bolagsverketMinimumIntervalMs("bolagsverket_vardefulla_datamangder")).toBe(1_050);
    expect(bolagsverketMinimumIntervalMs("bolagsverket_foretagsinformation")).toBe(55);
    expect(bolagsverketMinimumIntervalMs("unknown")).toBe(1_050);
  });

  it("requires HTTPS and rejects credentials embedded in Bolagsverket URLs", () => {
    expect(requireBolagsverketHttpsUrl("https://example.invalid/api", "TEST").protocol).toBe("https:");
    expect(() => requireBolagsverketHttpsUrl("http://example.invalid/api", "TEST"))
      .toThrow("TEST must use HTTPS");
    expect(() => requireBolagsverketHttpsUrl("https://user:pass@example.invalid/api", "TEST"))
      .toThrow("TEST must not embed credentials");
  });

  it("allows company-shaped discovery seeds but blocks sole traders and person-shaped identifiers", () => {
    expect(canQueryBolagsverketCompanyDetail(candidate())).toBe(true);
    expect(canQueryBolagsverketCompanyDetail(candidate({ organizationKind: "unknown" }))).toBe(true);
    expect(canQueryBolagsverketCompanyDetail(candidate({ organizationKind: "sole_trader", legalForm: "Enskild firma" }))).toBe(false);
    expect(canQueryBolagsverketCompanyDetail(candidate({ countryCode: "NO" }))).toBe(false);
    expect(canQueryBolagsverketCompanyDetail(candidate({ organizationNumber: "8501011234" }))).toBe(false);
    expect(canQueryBolagsverketCompanyDetail(candidate({ organizationNumber: "123" }))).toBe(false);
  });

  it("does not call Bolagsverket detail for a sole trader", async () => {
    process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://example.invalid/organisationer";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const input = candidate({ organizationKind: "sole_trader", legalForm: "Enskild firma" });

    await expect(verifyOfficialCompanyCandidate(input)).resolves.toEqual(input);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an insecure detail URL before the data request", async () => {
    process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "http://example.invalid/organisationer";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyOfficialCompanyCandidate(candidate()))
      .rejects.toThrow("COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an insecure source URL before OAuth or data fetch", async () => {
    process.env.COMPANY_DIRECTORY_SOURCE_URL = "http://example.invalid/companies";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchOfficialCompanyDirectoryBatch())
      .rejects.toThrow("COMPANY_DIRECTORY_SOURCE_URL must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an insecure OAuth token URL before credentials are sent", async () => {
    process.env.COMPANY_DIRECTORY_SOURCE_URL = "https://example.invalid/companies";
    process.env.COMPANY_DIRECTORY_TOKEN_URL = "http://example.invalid/token";
    process.env.BOLAGSVERKET_CLIENT_ID = "client";
    process.env.BOLAGSVERKET_CLIENT_SECRET = "secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchOfficialCompanyDirectoryBatch())
      .rejects.toThrow("COMPANY_DIRECTORY_TOKEN_URL must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publishes conditional Lantmäteriet attribution and Proffera own-processing wording", () => {
    expect(directoryProfileCopy.sv.sourceLead).toContain("Bolagsverket");
    expect(directoryProfileCopy.sv.sourceLead).toContain("SCB");
    expect(directoryProfileCopy.sv.sourceLead).toContain("Lantmäteriet – Belägenhetsadress Direkt");
    expect(directoryProfileCopy.sv.sourceLead).toContain("egen bearbetning");
    expect(directoryProfileCopy.en.sourceLead).toContain("Lantmäteriet – Belägenhetsadress Direkt");
    expect(directoryProfileCopy.en.sourceLead).toContain("processed by Proffera");

    const nearbySv = directoryCopy.sv.nearbyNotice(25);
    const nearbyEn = directoryCopy.en.nearbyNotice(25);
    expect(nearbySv).toContain("När Lantmäteriets positionsdata används");
    expect(nearbySv).toContain("egen bearbetning");
    expect(nearbyEn).toContain("Where Lantmäteriet position data is used");
    expect(nearbyEn).toContain("processed by Proffera");
  });
});
