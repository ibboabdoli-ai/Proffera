import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { selectReadyAutoPublishRows } from "@/lib/company-directory-ready-auto-publish";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory Ready publication selection", () => {
  it("guarantees rotating backlog progress when fresh demand fills the default limit", () => {
    const fresh = Array.from({ length: 10 }, (_, index) => `fresh-${index + 1}`);
    const backlog = ["backlog-1", "backlog-2"];

    const selected = selectReadyAutoPublishRows(fresh, backlog, 10);

    expect(selected).toHaveLength(10);
    expect(selected).toContain("backlog-1");
    expect(selected.filter((item) => item.startsWith("fresh-"))).toHaveLength(9);
  });

  it("uses all capacity for fresh Ready rows when the rotated backlog has no eligible row", () => {
    const fresh = Array.from({ length: 10 }, (_, index) => `fresh-${index + 1}`);

    expect(selectReadyAutoPublishRows(fresh, [], 10)).toEqual(fresh);
  });

  it("keeps the backlog guarantee even with a one-row publication limit", () => {
    expect(selectReadyAutoPublishRows(["fresh-1"], ["backlog-1"], 1)).toEqual(["backlog-1"]);
  });
});

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
    expect(resolver).toContain("selectReadyAutoPublishRows(freshHighConfidence, backlogHighConfidence, safeLimit)");
  });

  it("keeps fresh and backlog scan egress plus publication work bounded", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("READY_AUTO_PUBLISH_FAST_SCAN_SIZE = 10");
    expect(resolver).toContain("READY_AUTO_PUBLISH_SCAN_SIZE = 25");
    expect(resolver).toContain("DEFAULT_READY_AUTO_PUBLISH_BATCH_SIZE = 10");
    expect(resolver).toContain("MAX_READY_AUTO_PUBLISH_BATCH_SIZE = 20");
    expect(resolver).toContain("limit ${READY_AUTO_PUBLISH_FAST_SCAN_SIZE}");
    expect(resolver).toContain("limit ${READY_AUTO_PUBLISH_SCAN_SIZE}");
  });

  it("prioritizes newly verified Ready rows without removing backlog rotation", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("from company_directory_discovery_queue queue");
    expect(resolver).toContain("join company_directory_profiles profile on profile.id = queue.profile_id");
    expect(resolver).toContain("queue.state = 'ready'");
    expect(resolver).toContain("queue.verified_at is not null");
    expect(resolver).toContain("order by queue.verified_at desc, queue.last_seen_at desc, profile.organization_number asc");
    expect(resolver).toContain("const scanOffset = (rotation % scanPages) * READY_AUTO_PUBLISH_SCAN_SIZE");
    expect(resolver).toContain("order by profile.organization_number asc");
  });

  it("deduplicates overlap between the fresh lane and rotating backlog", () => {
    const resolver = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(resolver).toContain("const seenProfileIds = new Set<string>()");
    expect(resolver).toContain("const uniqueFreshRows = freshRows.filter((row) =>");
    expect(resolver).toContain("const uniqueBacklogRows = backlogRows.filter((row) =>");
    expect(resolver).toContain("seenProfileIds.has(profileId)");
    expect(resolver).toContain("seenProfileIds.add(profileId)");
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
