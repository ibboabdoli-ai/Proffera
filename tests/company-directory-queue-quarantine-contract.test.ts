import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory queue quarantine contract", () => {
  it("attaches the profile before Official Facts and retries per item", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");
    const start = queue.indexOf("export async function processCompanyDirectoryDiscoveryQueue");
    const end = queue.indexOf("async function requeueControlledBatchPilotItem", start);
    const automaticQueue = queue.slice(start, end);

    const upsert = automaticQueue.indexOf("await upsertCompanyDirectoryCandidate");
    const attach = automaticQueue.indexOf("await attachQueueProfile");
    const enrich = automaticQueue.indexOf("await enrichCompanyDirectoryOfficialFactsForProfile");

    expect(upsert).toBeGreaterThanOrEqual(0);
    expect(attach).toBeGreaterThan(upsert);
    expect(enrich).toBeGreaterThan(attach);
    expect(automaticQueue).toContain("profileId: itemProfileId");
    expect(queue).toContain("MAX_ATTEMPTS = 5");
  });

  it("quarantines only Ready profiles when a queue item becomes terminal", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain("state = ${terminal ? \"failed\" : \"pending_verify\"}");
    expect(queue).toContain("set publication_status = 'review'");
    expect(queue).toContain("profile.publication_status = 'ready'");
    expect(queue).not.toContain("profile.publication_status = 'published'\n      and");
  });

  it("uses the same terminal quarantine for expired leases and pilot retries", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain("with recovered as (");
    expect(queue).toContain("recovered.attempt_count >= ${MAX_ATTEMPTS}");
    expect(queue).toContain("with failed_item as (");
    expect(queue).toContain("targeted pilot retry:");
    expect(queue).toContain("controlled batch pilot retry:");
  });

  it("keeps the observable backlog truthful but skips failed queue items in scheduled enrichment", () => {
    const facts = source("src/lib/company-directory-official-facts.ts");
    const backlogStart = facts.indexOf("export async function getCompanyDirectoryOfficialFactsBacklog");
    const perProfileStart = facts.indexOf("export async function enrichCompanyDirectoryOfficialFactsForProfile", backlogStart);
    const batchStart = facts.indexOf("export async function enrichCompanyDirectoryOfficialFacts(limit?: number)");
    const backlog = facts.slice(backlogStart, perProfileStart);
    const batch = facts.slice(batchStart);

    expect(backlog).toContain("facts.profile_id is null or facts.last_synced_at < profile.last_synced_at");
    expect(backlog).not.toContain("queue.state = 'failed'");
    expect(batch).toContain("company_directory_discovery_queue queue");
    expect(batch).toContain("queue.state = 'failed'");
    expect(batch).toContain("queue.profile_id = profile.id");
    expect(batch).toContain("queue.organization_number = regexp_replace(profile.organization_number");
  });
});
