import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  rememberCompleteBolagsverketOrganizationRecord,
  takeCompleteBolagsverketOrganizationRecord,
} from "../src/lib/company-directory-detail-cache";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory verified-detail reuse", () => {
  it("keeps verified detail records single-use and keyed by exact organization number", () => {
    const record = {
      organisationsidentitet: { identitetsbeteckning: "5560000001" },
      organisationsnamn: { organisationsnamnLista: [] },
    };

    rememberCompleteBolagsverketOrganizationRecord("556000-0001", record);

    expect(takeCompleteBolagsverketOrganizationRecord("5560000001")).toBe(record);
    expect(takeCompleteBolagsverketOrganizationRecord("5560000001")).toBeNull();
    expect(takeCompleteBolagsverketOrganizationRecord("5560000002")).toBeNull();
  });

  it("expires verified detail records after 60 seconds", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const record = { marker: "expires" };

    try {
      rememberCompleteBolagsverketOrganizationRecord("5560000011", record);

      now.mockReturnValue(61_000);
      expect(takeCompleteBolagsverketOrganizationRecord("5560000011")).toBeNull();
    } finally {
      now.mockRestore();
    }
  });

  it("evicts the oldest record when more than 50 verified details are cached", () => {
    const records = Array.from({ length: 51 }, (_, index) => ({
      organizationNumber: String(5561000000 + index),
      record: { marker: index },
    }));

    for (const entry of records) {
      rememberCompleteBolagsverketOrganizationRecord(entry.organizationNumber, entry.record);
    }

    expect(
      takeCompleteBolagsverketOrganizationRecord(records[0].organizationNumber),
    ).toBeNull();
    expect(
      takeCompleteBolagsverketOrganizationRecord(records[50].organizationNumber),
    ).toBe(records[50].record);

    for (const entry of records.slice(1, 50)) {
      takeCompleteBolagsverketOrganizationRecord(entry.organizationNumber);
    }
  });

  it("remembers only detail responses that passed complete Bolagsverket validation", () => {
    const validation = source("src/lib/company-directory-detail-validation.ts");

    const completeValidation = validation.indexOf("resolveBolagsverketOrganizationRecord(payload, requestedOrganizationNumber)");
    const remember = validation.indexOf("rememberCompleteBolagsverketOrganizationRecord(requestedOrganizationNumber, record)");

    expect(validation).toContain("collectBolagsverketApiErrors(payload)");
    expect(completeValidation).toBeGreaterThanOrEqual(0);
    expect(remember).toBeGreaterThan(completeValidation);
  });

  it("consumes the verified detail before OAuth or a second detail lookup", () => {
    const facts = source("src/lib/company-directory-official-facts.ts");
    const start = facts.indexOf("export async function enrichCompanyDirectoryOfficialFactsForProfile");
    const end = facts.indexOf("export async function enrichCompanyDirectoryOfficialFacts(limit?: number)", start);
    const perProfile = facts.slice(start, end);

    const cacheRead = perProfile.indexOf("takeCachedOfficialFacts(organizationNumber)");
    const oauth = perProfile.indexOf("await oauthAccessToken()");
    const networkLookup = perProfile.indexOf("await fetchOfficialFacts(organizationNumber, token)");

    expect(cacheRead).toBeGreaterThanOrEqual(0);
    expect(oauth).toBeGreaterThan(cacheRead);
    expect(networkLookup).toBeGreaterThan(oauth);
    expect(perProfile).toContain("reusedVerifiedDetail: true");
    expect(perProfile).toContain("reusedVerifiedDetail: false");
  });

  it("keeps the scheduled Official Facts batch on the existing network fallback", () => {
    const facts = source("src/lib/company-directory-official-facts.ts");
    const start = facts.indexOf("export async function enrichCompanyDirectoryOfficialFacts(limit?: number)");
    const batch = facts.slice(start);

    expect(batch).toContain("await oauthAccessToken()");
    expect(batch).toContain("await fetchOfficialFacts(organizationNumber, token)");
  });

  it("does not persist the transient raw-detail cache", () => {
    const cache = source("src/lib/company-directory-detail-cache.ts");

    expect(cache).not.toContain("getSql");
    expect(cache).not.toContain("process.env");
  });
});
