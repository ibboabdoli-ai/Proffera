import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory manual refresh contract", () => {
  it("refreshes only ready low-confidence profiles from the admin-triggered flow", () => {
    const manualRefresh = source("src/lib/company-directory-manual-refresh.ts");

    expect(manualRefresh).toContain("p.publication_status = 'ready'");
    expect(manualRefresh).toContain("categoryConfidence.score < 95");
    expect(manualRefresh).toContain("enrichCompanyDirectoryOfficialFactsForProfile");
    expect(manualRefresh).toContain("f.last_synced_at < ${scanStartedAt}::timestamptz");
    expect(manualRefresh).toContain("MAX_BATCH_SIZE = 5");
  });

  it("does not pre-limit candidate rows before applying the confidence predicate", () => {
    const manualRefresh = source("src/lib/company-directory-manual-refresh.ts");
    const candidateQueryStart = manualRefresh.indexOf("async function lowConfidenceCandidates");
    const candidateFilter = manualRefresh.indexOf("return rows.filter", candidateQueryStart);
    const candidateSection = manualRefresh.slice(candidateQueryStart, candidateFilter);

    expect(candidateQueryStart).toBeGreaterThanOrEqual(0);
    expect(candidateFilter).toBeGreaterThan(candidateQueryStart);
    expect(candidateSection).not.toContain("MAX_CANDIDATES_PER_SCAN");
    expect(candidateSection).not.toContain("limit ${");
  });

  it("reuses the shared fail-closed publication gate and never writes published state directly", () => {
    const manualRefresh = source("src/lib/company-directory-manual-refresh.ts");

    expect(manualRefresh).toContain("publishCompanyDirectoryProfileIfSafe");
    expect(manualRefresh).not.toContain("autoPublishCompanyDirectoryProfileIfSafe");
    expect(manualRefresh).not.toContain("set publication_status = 'published'");
    expect(manualRefresh).not.toContain("update company_directory_profiles");
  });

  it("requires super-admin access and is not wired into the scheduled cron", () => {
    const actions = source("src/app/admin/foretag/directory/actions.ts");
    const cron = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(actions).toContain("await requireSuperAdmin()");
    expect(actions).toContain("refreshLowConfidenceCompanyDirectoryBatch");
    expect(cron).not.toContain("company-directory-manual-refresh");
    expect(cron).not.toContain("refreshLowConfidenceCompanyDirectoryBatch");
  });

  it("treats Bolagsverket 429 responses as a retryable cooldown instead of a fatal refresh error", () => {
    const manualRefresh = source("src/lib/company-directory-manual-refresh.ts");

    expect(manualRefresh).toContain("RATE_LIMIT_RETRY_SECONDS = 65");
    expect(manualRefresh).toContain("isOfficialFactsRateLimit");
    expect(manualRefresh).toContain("Official facts (?:lookup|OAuth) failed");
    expect(manualRefresh).toContain("rateLimited = true");
    expect(manualRefresh).toContain("retryAfterSeconds");
  });

  it("does not scan the entire low-confidence backlog twice per batch", () => {
    const manualRefresh = source("src/lib/company-directory-manual-refresh.ts");
    const candidateCalls = manualRefresh.match(/await lowConfidenceCandidates\(sql, scanStartedAt\)/g) ?? [];

    expect(candidateCalls).toHaveLength(1);
    expect(manualRefresh).toContain("const remaining = Math.max(0, candidates.length - refreshed)");
  });

  it("paces the single-click admin control below the documented 60-requests-per-minute limit", () => {
    const control = source("src/app/admin/foretag/directory/DirectoryLowConfidenceRefreshButton.tsx");
    const layout = source("src/app/admin/foretag/directory/layout.tsx");

    expect(control).toContain("Uppdatera profiler under 95%");
    expect(control).toContain("BATCH_PAUSE_MS = 7_000");
    expect(control).toContain("MAX_BATCHES_PER_CLICK = 500");
    expect(control).toContain("result.rateLimited");
    expect(control).toContain("result.retryAfterSeconds * 1_000");
    expect(control).toContain("60 frågor/minut");
    expect(control).toContain("result.errors > 0 || result.completed || result.selected === 0");
    expect(control).toContain('pathname !== "/admin/foretag/directory"');
    expect(control).not.toContain("batch < 100");
    expect(layout).toContain("DirectoryLowConfidenceRefreshButton");
  });

  it("retries transient server-action failures without refreshing the route between every batch", () => {
    const control = source("src/app/admin/foretag/directory/DirectoryLowConfidenceRefreshButton.tsx");
    const routeRefreshes = control.match(/router\.refresh\(\)/g) ?? [];

    expect(control).toContain("ACTION_RETRY_DELAYS_MS = [3_000, 10_000, 30_000]");
    expect(control).toContain("runBatchWithRetry");
    expect(control).toContain("Tillfälligt serverfel. Nytt försök");
    expect(control).toContain("Redan uppdaterade profiler är sparade");
    expect(routeRefreshes).toHaveLength(1);
  });
});
