import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("safe company directory auto publication contract", () => {
  it("never publishes from candidate upsert alone", () => {
    const engine = source("src/lib/company-directory-engine.ts");

    expect(engine).toContain("const desiredStatus = assessment.publicationStatus;");
    expect(engine).not.toContain("function autoPublishEnabled");
    expect(engine).not.toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
  });

  it("publishes automatic queue work only after successful Official Facts enrichment", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");
    const start = queue.indexOf("export async function processCompanyDirectoryDiscoveryQueue");
    const end = queue.indexOf("async function requeueControlledBatchPilotItem", start);
    const automaticQueue = queue.slice(start, end);

    const upsert = automaticQueue.indexOf("await upsertCompanyDirectoryCandidate");
    const enrich = automaticQueue.indexOf("await enrichCompanyDirectoryOfficialFactsForProfile");
    const publish = automaticQueue.indexOf("await autoPublishCompanyDirectoryProfileIfSafe");
    const complete = automaticQueue.indexOf("await completeQueueItem");

    expect(upsert).toBeGreaterThanOrEqual(0);
    expect(enrich).toBeGreaterThan(upsert);
    expect(publish).toBeGreaterThan(enrich);
    expect(complete).toBeGreaterThan(publish);
  });

  it("uses one fail-closed safety gate for manual and automatic publication", () => {
    const publication = source("src/lib/company-directory-publication.ts");
    const admin = source("src/lib/company-directory-publication-admin.ts");

    expect(admin).toContain("publishCompanyDirectoryProfileIfSafe(profileId)");
    expect(publication).toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
    expect(publication).toContain('text(row.publication_status) !== "ready"');
    expect(publication).toContain("!Boolean(row.is_active)");
    expect(publication).toContain("Boolean(row.privacy_blocked)");
    expect(publication).toContain("!Boolean(row.auto_public_eligible)");
    expect(publication).toContain("Boolean(row.claimed_workspace_id)");
    expect(publication).toContain("!confidence.officialFactsReady");
    expect(publication).toContain("!officialFactsFresh");
    expect(publication).toContain("confidence.score < 95");
    expect(publication).toContain("Boolean(row.deregistration_date)");
    expect(publication).toContain("Boolean(row.advertising_blocked)");
    expect(publication).toContain("jsonArray(row.ongoing_procedures).length > 0");
  });

  it("rechecks freshness and safety atomically before changing Ready to Published", () => {
    const publication = source("src/lib/company-directory-publication.ts");

    expect(publication).toContain("and p.publication_status = 'ready'");
    expect(publication).toContain("and p.is_active = true");
    expect(publication).toContain("and p.privacy_blocked = false");
    expect(publication).toContain("and p.auto_public_eligible = true");
    expect(publication).toContain("and p.claimed_workspace_id is null");
    expect(publication).toContain("and f.last_synced_at >= p.last_synced_at");
    expect(publication).toContain("and f.source_payload_hash = ${factsSourcePayloadHash}");
    expect(publication).toContain("and f.deregistration_date is null");
    expect(publication).toContain("and coalesce(f.advertising_blocked, false) = false");
    expect(publication).toContain("jsonb_array_length(coalesce(f.ongoing_procedures, '[]'::jsonb)) = 0");
  });
});
