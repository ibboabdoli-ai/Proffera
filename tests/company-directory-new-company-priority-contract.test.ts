import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory new-company priority", () => {
  it("does not requeue unchanged existing profiles just because the daily source fingerprint changed", () => {
    const ingest = source("src/app/api/cron/company-directory-discovery-ingest/route.ts");

    expect(ingest).toContain("filterCandidatesNeedingVerification");
    expect(ingest).toContain("from company_directory_profiles profile");
    expect(ingest).toContain("profile.country_code = 'SE'");
    expect(ingest).toContain("profile.primary_sni_code");
    expect(ingest).toContain("item.primary_sni_code = ''");
    expect(ingest).toContain("candidates: candidatesNeedingVerification");
    expect(ingest).toContain("queued: candidatesNeedingVerification.length");
  });

  it("processes unprofiled companies before the normal discovery backlog", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain("processNewCompanyDirectoryDiscoveryQueueBatch");
    expect(route).toContain("processCompanyDirectoryDiscoveryQueue");

    const newCompanyIndex = route.indexOf("await processNewCompanyDirectoryDiscoveryQueueBatch");
    const backlogIndex = route.indexOf("await processCompanyDirectoryDiscoveryQueue");

    expect(newCompanyIndex).toBeGreaterThan(-1);
    expect(backlogIndex).toBeGreaterThan(newCompanyIndex);
    expect(route).toContain("newCompanies,");
  });
});
