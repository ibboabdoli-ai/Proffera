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
    expect(resolver).toContain("autoPublishCompanyDirectoryProfileIfSafe");
    expect(resolver).toContain("confidence.score >= 95");
    expect(resolver).toContain("confidence.officialFactsReady");
  });

  it("selects only high-confidence Ready profiles for publication work", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("return confidence.officialFactsReady && confidence.score >= 95");
    expect(resolver).toContain("const selected = highConfidence.slice(0, safeLimit)");
  });

  it("keeps both scan egress and publication work bounded", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("READY_AUTO_PUBLISH_SCAN_SIZE = 25");
    expect(resolver).toContain("DEFAULT_READY_AUTO_PUBLISH_BATCH_SIZE = 10");
    expect(resolver).toContain("MAX_READY_AUTO_PUBLISH_BATCH_SIZE = 20");
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
    expect(resolver).toContain("facts.source_payload_hash <> ''");
    expect(resolver).toContain("facts.deregistration_date is null");
    expect(resolver).toContain("coalesce(facts.advertising_blocked, false) = false");
    expect(resolver).toContain("jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0");
  });

  it("synchronizes a Ready queue row only after the profile is published", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("queue.state = 'ready'");
    expect(resolver).toContain("profile.publication_status = 'published'");
    expect(resolver).toContain("set state = 'published'");
  });

  it("runs high-confidence Ready reconciliation before bounded new queue claims", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");
    const automaticStart = route.indexOf('if (mode === "automatic")');
    const readyAutoPublish = route.indexOf(
      "await autoPublishReadyHighConfidenceCompanyDirectoryBatch()",
      automaticStart,
    );
    const newCompanyQueue = route.indexOf(
      "await processNewCompanyDirectoryDiscoveryQueueBatch(AUTOMATIC_QUEUE_CRON_BATCH_SIZE)",
      automaticStart,
    );
    const processQueue = route.indexOf(
      "await processCompanyDirectoryDiscoveryQueue(remainingBatchSize)",
      automaticStart,
    );

    expect(automaticStart).toBeGreaterThanOrEqual(0);
    expect(readyAutoPublish).toBeGreaterThan(automaticStart);
    expect(newCompanyQueue).toBeGreaterThan(readyAutoPublish);
    expect(processQueue).toBeGreaterThan(newCompanyQueue);
    expect(route).toContain("const AUTOMATIC_QUEUE_CRON_BATCH_SIZE = 5");
    expect(route).toContain("AUTOMATIC_QUEUE_CRON_BATCH_SIZE - newCompanies.claimed");
    expect(route).toContain("readyAutoPublish");
  });
});
