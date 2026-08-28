import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory queue quarantine contract", () => {
  it("restores the claimed lease after the profile trigger and before Official Facts", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");
    const start = queue.indexOf("export async function processCompanyDirectoryDiscoveryQueue");
    const end = queue.indexOf("async function requeueControlledBatchPilotItem", start);
    const automaticQueue = queue.slice(start, end);

    const upsert = automaticQueue.indexOf("await upsertCompanyDirectoryCandidate");
    const restore = automaticQueue.indexOf("await restoreQueueLeaseAfterProfileUpsert");
    const enrich = automaticQueue.indexOf("await enrichCompanyDirectoryOfficialFactsForProfile");

    expect(upsert).toBeGreaterThanOrEqual(0);
    expect(restore).toBeGreaterThan(upsert);
    expect(enrich).toBeGreaterThan(restore);
    expect(queue).toContain("queue.source_fingerprint");
    expect(queue).toContain("sourceFingerprint: text(row.source_fingerprint)");
    expect(queue).toContain("set state = 'processing'");
    expect(queue).toContain("and attempt_count = ${input.attemptCount}");
    expect(queue).toContain("and source_fingerprint = ${input.sourceFingerprint}");
    expect(queue).toContain("and locked_at is null");
    expect(queue).toContain("and lock_token is null");
    expect(queue).toContain("Directory queue lease changed during profile upsert");
    expect(queue).toContain("MAX_ATTEMPTS = 5");
  });

  it("restores the lease in automatic, targeted pilot, and controlled batch paths", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");
    const restoreCalls = queue.match(/await restoreQueueLeaseAfterProfileUpsert\(/g) ?? [];

    expect(restoreCalls).toHaveLength(3);
    expect(queue).toContain("sourceFingerprint: item.sourceFingerprint");
  });

  it("quarantines only Ready profiles and reasserts terminal failed state after the profile trigger", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain("async function reassertTerminalQueueFailure");
    expect(queue).toContain("set state = 'failed'");
    expect(queue).toContain("set publication_status = 'review'");
    expect(queue).toContain("publication_status = 'ready'");
    expect(queue).toContain("await reassertTerminalQueueFailure({");
    expect(queue).toContain("and profile_id = ${input.profileId}::uuid");
    expect(queue).toContain("and attempt_count = ${input.attemptCount}");
    expect(queue).toContain("and source_fingerprint = ${input.sourceFingerprint}");
    expect(queue).not.toContain("where id = ${failedProfileId}::uuid\n      and publication_status = 'published'");
  });

  it("uses guarded terminal quarantine for expired leases and pilot retries", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain("const recovered = await sql`");
    expect(queue).toContain("returning id::text, profile_id::text, source_fingerprint, attempt_count, last_error");
    expect(queue).toContain("attemptCount < MAX_ATTEMPTS");
    expect(queue).toContain("reassertTerminalQueueFailure");
    expect(queue).toContain('errorPrefix: "targeted pilot retry: "');
    expect(queue).toContain('errorPrefix: "controlled batch pilot retry: "');
  });

  it("only invokes auto publication for Ready profiles", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain('const autoPublication = result.publicationStatus === "ready"');
    expect(queue).toContain("? await autoPublishCompanyDirectoryProfileIfSafe(result.profileId)");
  });

  it("keeps the observable backlog truthful, repairs only legacy Bolagsverket unknown reklamspärr, and skips failed queue items in scheduled enrichment", () => {
    const facts = source("src/lib/company-directory-official-facts.ts");
    const backlogStart = facts.indexOf("export async function getCompanyDirectoryOfficialFactsBacklog");
    const perProfileStart = facts.indexOf("export async function enrichCompanyDirectoryOfficialFactsForProfile", backlogStart);
    const batchStart = facts.indexOf("export async function enrichCompanyDirectoryOfficialFacts(limit?: number)");
    const backlog = facts.slice(backlogStart, perProfileStart);
    const batch = facts.slice(batchStart);
    const legacyUnknownCooldown = /or\s*\(\s*facts\.advertising_blocked is null\s+and facts\.data_producers->>'postadressOrganisation' = 'Bolagsverket'\s+and facts\.last_synced_at < \$\{LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE\}::timestamptz\s+and facts\.last_synced_at < now\(\) - interval '1 hour'\s*\)/;
    const repairableUnknownFirst = /order by\s+case\s+when facts\.advertising_blocked is null\s+and facts\.data_producers->>'postadressOrganisation' = 'Bolagsverket'\s+and facts\.last_synced_at < \$\{LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE\}::timestamptz\s+then 0\s+else 1\s+end,\s*facts\.last_synced_at asc nulls first,\s*profile\.last_synced_at asc,\s*profile\.organization_number asc/;
    const failedQueueExclusion = /and not exists\s*\(\s*select 1\s+from company_directory_discovery_queue queue\s+where queue\.state = 'failed'\s+and \(\s*queue\.profile_id = profile\.id\s+or \(\s*queue\.country_code = profile\.country_code\s+and queue\.organization_number = regexp_replace\(profile\.organization_number[\s\S]*?\)\s*\)\s*\)\s*order by/;

    expect(facts).toContain('const LEGACY_REKLAMSPARR_NULL_REPAIR_BEFORE = "2026-08-28T07:30:00.000Z";');
    expect(backlog).toContain("facts.profile_id is null");
    expect(backlog).toContain("facts.last_synced_at < profile.last_synced_at");
    expect(backlog).toMatch(legacyUnknownCooldown);
    expect(backlog).not.toContain("queue.state = 'failed'");
    expect(batch).toMatch(legacyUnknownCooldown);
    expect(batch).toMatch(repairableUnknownFirst);
    expect(batch).toMatch(failedQueueExclusion);
  });
});
