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

  it("exposes a single-click admin control that stops safely on errors", () => {
    const control = source("src/app/admin/foretag/directory/DirectoryLowConfidenceRefreshButton.tsx");
    const layout = source("src/app/admin/foretag/directory/layout.tsx");

    expect(control).toContain("Uppdatera profiler under 95%");
    expect(control).toContain("result.errors > 0 || result.completed || result.selected === 0");
    expect(control).toContain('pathname !== "/admin/foretag/directory"');
    expect(layout).toContain("DirectoryLowConfidenceRefreshButton");
  });
});
