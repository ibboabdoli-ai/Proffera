import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory published revalidation contract", () => {
  it("keeps the batch deliberately small and protected by a single-run lease", () => {
    const worker = source("src/lib/company-directory-published-revalidation.ts");

    expect(worker).toContain("DEFAULT_REVALIDATION_BATCH_SIZE = 2");
    expect(worker).toContain("MAX_REVALIDATION_BATCH_SIZE = 3");
    expect(worker).toContain('REVALIDATION_PROVIDER = "published_revalidation"');
    expect(worker).toContain("on conflict do nothing");
    expect(worker).toContain("started_at < now() - interval '10 minutes'");
  });

  it("revalidates only unclaimed published Swedish juridical persons", () => {
    const worker = source("src/lib/company-directory-published-revalidation.ts");

    expect(worker).toContain("profile.publication_status = 'published'");
    expect(worker).toContain("profile.country_code = 'SE'");
    expect(worker).toContain("profile.organization_kind = 'juridical_person'");
    expect(worker).toContain("profile.claimed_workspace_id is null");
  });

  it("refreshes Official Facts before SCB and uses a controlled explicit SCB transport", () => {
    const worker = source("src/lib/company-directory-published-revalidation.ts");
    const officialFacts = worker.indexOf("await enrichCompanyDirectoryOfficialFactsForProfile(profileId)");
    const scb = worker.indexOf("await enrichCompanyDirectoryScbForProfile(profileId, transport");

    expect(officialFacts).toBeGreaterThanOrEqual(0);
    expect(scb).toBeGreaterThan(officialFacts);
    expect(worker).toContain("createScbCompanyRegistryTransportFromEnv");
    expect(worker).toContain("allowWhenDisabledWithExplicitTransport: true");
  });

  it("does not open the normal global SCB publication gate", () => {
    const provider = source("src/lib/company-directory-scb-provider.ts");

    expect(provider).toContain("const controlledTransportAllowed = options.allowWhenDisabledWithExplicitTransport === true && Boolean(transport)");
    expect(provider).toContain("if (!enabled && !controlledTransportAllowed) return { status: \"disabled\", data: null }");
  });

  it("requires fresh Official Facts and SCB snapshots before changing publication status", () => {
    const worker = source("src/lib/company-directory-published-revalidation.ts");

    expect(worker).toContain("Boolean(row.official_facts_fresh) && Boolean(row.scb_snapshot_fresh)");
    expect(worker).toContain("profile.updated_at::text = ${input.profileUpdatedToken}");
    expect(worker).toContain("facts.last_synced_at::text = ${input.factsLastSyncedToken}");
    expect(worker).toContain("scb.source_payload_hash = ${input.scbSourcePayloadHash}");
  });

  it("moves a published profile to review only for unsafe, low-confidence, or conflicting fresh evidence", () => {
    const worker = source("src/lib/company-directory-published-revalidation.ts");

    expect(worker).toContain("confidence.score < 95");
    expect(worker).toContain("scbConflictCount > 0");
    expect(worker).toContain("const shouldReview = unsafe");
    expect(worker).toContain("set publication_status = 'review'");
    expect(worker).toContain("published_at = null");
  });

  it("protects the cron endpoint and schedules bounded cleanup every five minutes", () => {
    const route = source("src/app/api/cron/company-directory-published-revalidation/route.ts");
    const vercel = source("vercel.json");

    expect(route).toContain("authorization !== `Bearer ${secret}`");
    expect(route).toContain('process.env.COMPANY_DIRECTORY_SYNC_ENABLED !== "true"');
    expect(route).toContain("revalidatePublishedCompanyDirectoryBatch(limit)");
    expect(vercel).toContain('"path": "/api/cron/company-directory-published-revalidation"');
    expect(vercel).toContain('"schedule": "*/5 * * * *"');
  });
});
