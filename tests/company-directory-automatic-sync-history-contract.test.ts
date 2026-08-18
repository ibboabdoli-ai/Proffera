import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory automatic sync history contract", () => {
  it("records automatic queue runs in the admin sync history table", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain('const AUTOMATIC_QUEUE_HISTORY_PROVIDER = "automatic_queue"');
    expect(route).toContain("insert into company_directory_sync_runs");
    expect(route).toContain("scanned_count, upserted_count, published_count");
    expect(route).toContain("blocked_count, error_count, error_summary, started_at, completed_at");
  });

  it("aggregates all bounded automatic queue and publication work before recording success", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain("readyAutoPublish.scanned + newCompanies.claimed + result.claimed");
    expect(route).toContain("newCompanies.processed + result.processed");
    expect(route).toContain("readyAutoPublish.published + newCompanies.published + result.published");
    expect(route).toContain("newCompanies.blocked + result.blocked");
    expect(route).toContain("readyAutoPublish.errors + newCompanies.errors + result.errors");
    expect(route).toContain('status: "completed"');
    expect(route).toContain("historyRecorded");
  });

  it("records a failed automatic queue run without replacing the cron error response", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    const modeGuard = route.indexOf('if (mode === "automatic")');
    const catchStart = route.lastIndexOf("} catch (error) {");
    const failedHistory = route.indexOf('status: "failed"', catchStart);
    const errorResponse = route.indexOf("{ status: 500 }", catchStart);

    expect(modeGuard).toBeGreaterThanOrEqual(0);
    expect(catchStart).toBeGreaterThan(modeGuard);
    expect(failedHistory).toBeGreaterThan(catchStart);
    expect(errorResponse).toBeGreaterThan(failedHistory);
    expect(route).toContain("Company directory automatic queue history write failed");
  });
});
