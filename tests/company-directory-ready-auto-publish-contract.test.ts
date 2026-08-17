import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory high-confidence Ready auto-publish contract", () => {
  it("reuses the shared confidence assessment and fail-closed publication gate", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("assessCompanyDirectoryCategoryConfidence");
    expect(resolver).toContain("confidence.officialFactsReady && confidence.score >= 95");
    expect(resolver).toContain("autoPublishCompanyDirectoryProfileIfSafe");
    expect(resolver).toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
  });

  it("never turns low-confidence Ready profiles into scheduled refresh work", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).not.toContain("enrichCompanyDirectoryOfficialFactsForProfile");
    expect(resolver).not.toContain("refreshLowConfidenceCompanyDirectoryBatch");
    expect(resolver).not.toContain("publication_status = 'review'");
    expect(resolver).not.toContain("state = 'review'");
  });

  it("keeps both scan egress and publication work bounded", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("MAX_READY_AUTO_PUBLISH_BATCH_SIZE = 20");
    expect(resolver).toContain("READY_AUTO_PUBLISH_SCAN_SIZE = 25");
    expect(resolver).toContain("READY_AUTO_PUBLISH_ROTATION_MS = 15 * 60 * 1000");
    expect(resolver).toContain("offset ${scanOffset}");
    expect(resolver).toContain("limit ${READY_AUTO_PUBLISH_SCAN_SIZE}");
    expect(resolver).toContain("highConfidence.slice(0, safeLimit)");
  });

  it("preserves the existing database safety preconditions", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("profile.publication_status = 'ready'");
    expect(resolver).toContain("profile.is_active = true");
    expect(resolver).toContain("profile.privacy_blocked = false");
    expect(resolver).toContain("profile.auto_public_eligible = true");
    expect(resolver).toContain("profile.claimed_workspace_id is null");
    expect(resolver).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(resolver).toContain("facts.deregistration_date is null");
    expect(resolver).toContain("facts.advertising_blocked, false");
    expect(resolver).toContain("facts.ongoing_procedures");
  });

  it("synchronizes a Ready queue row only after the profile is published", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("queue.state = 'ready'");
    expect(resolver).toContain("profile.publication_status = 'published'");
    expect(resolver).toContain("set state = 'published'");
  });

  it("runs high-confidence Ready reconciliation before new queue claims", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");
    const automaticStart = route.indexOf('if (mode === "automatic")');
    const readyAutoPublish = route.indexOf(
      "await autoPublishReadyHighConfidenceCompanyDirectoryBatch()",
      automaticStart,
    );
    const processQueue = route.indexOf(
      "await processCompanyDirectoryDiscoveryQueue()",
      automaticStart,
    );

    expect(automaticStart).toBeGreaterThanOrEqual(0);
    expect(readyAutoPublish).toBeGreaterThan(automaticStart);
    expect(processQueue).toBeGreaterThan(readyAutoPublish);
    expect(route).toContain("readyAutoPublish");
  });
});
