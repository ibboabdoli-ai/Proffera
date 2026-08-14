import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory ready resolution contract", () => {
  it("reuses the shared fail-closed publication gate for ready profiles", () => {
    const resolver = source("src/lib/company-directory-ready-resolution.ts");

    expect(resolver).toContain("autoPublishCompanyDirectoryProfileIfSafe");
    expect(resolver).toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
    expect(resolver).toContain("queue.state = 'ready'");
    expect(resolver).toContain("profile.publication_status = 'ready'");
    expect(resolver).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(resolver).toContain("facts.source_payload_hash <> ''");
    expect(resolver).not.toContain("confidence.score");
    expect(resolver).not.toContain("deregistration_date");
    expect(resolver).not.toContain("advertising_blocked");
    expect(resolver).not.toContain("ongoing_procedures");
  });

  it("moves only fail-closed unsafe or low-confidence results to manual review", () => {
    const resolver = source("src/lib/company-directory-ready-resolution.ts");

    expect(resolver).toContain('publication.code === "unsafe"');
    expect(resolver).toContain('publication.code === "low_confidence"');
    expect(resolver).toContain("set publication_status = 'review'");
    expect(resolver).toContain("set state = 'review'");
    expect(resolver).toContain('publication.code === "not_ready"');
    expect(resolver).toContain("deferred += 1");
  });

  it("keeps the reconciliation bounded and synchronizes successful publications back to the queue", () => {
    const resolver = source("src/lib/company-directory-ready-resolution.ts");

    expect(resolver).toContain("MAX_READY_RESOLUTION_BATCH_SIZE = 20");
    expect(resolver).toContain("limit ${safeLimit}");
    expect(resolver).toContain("profile.publication_status = 'published'");
    expect(resolver).toContain("set state = 'published'");
    expect(resolver).toContain("and queue.state = 'ready'");
  });

  it("runs ready reconciliation before claiming new automatic queue work", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");
    const automaticStart = route.indexOf('if (mode === "automatic")');
    const resolveReady = route.indexOf("await resolveReadyCompanyDirectoryProfiles()", automaticStart);
    const processQueue = route.indexOf("await processCompanyDirectoryDiscoveryQueue()", automaticStart);

    expect(automaticStart).toBeGreaterThanOrEqual(0);
    expect(resolveReady).toBeGreaterThan(automaticStart);
    expect(processQueue).toBeGreaterThan(resolveReady);
    expect(route).toContain("readyResolution");
  });
});
