import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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

  it("bounds transient raw-detail memory and does not persist the cache", () => {
    const cache = source("src/lib/company-directory-detail-cache.ts");

    expect(cache).toContain("CACHE_TTL_MS = 60_000");
    expect(cache).toContain("MAX_CACHE_ENTRIES = 50");
    expect(cache).toContain("verifiedDetails.delete(normalized)");
    expect(cache).not.toContain("getSql");
    expect(cache).not.toContain("process.env");
  });
});
