import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("automatic company directory discovery contract", () => {
  it("uses a durable idempotent queue with leases", () => {
    const migration = source("db/migrations/20260810_0043_company_profile_discovery_queue.sql");
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(migration).toContain("company_directory_source_snapshots");
    expect(migration).toContain("company_directory_discovery_queue");
    expect(migration).toContain("company_directory_discovery_country_org_unique_idx");
    expect(migration).toContain("lock_token");
    expect(queue).toContain("for update skip locked");
    expect(queue).toContain("LEASE_MINUTES = 15");
    expect(queue).toContain("MAX_ATTEMPTS = 5");
    expect(queue).toContain("verifyOfficialCompanyCandidate");
    expect(queue).toContain("upsertCompanyDirectoryCandidate");
  });

  it("keeps discovery ingest secret-protected and restricted to official Bolagsverket HTTPS URLs", () => {
    const route = source("src/app/api/cron/company-directory-discovery-ingest/route.ts");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain('process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() === "automatic"');
    expect(route).toContain('url.protocol !== "https:"');
    expect(route).toContain('host !== "bolagsverket.se"');
    expect(route).toContain('host.endsWith(".bolagsverket.se")');
    expect(route).toContain("MAX_ORGANIZATION_NUMBERS = 500");
  });

  it("processes the durable queue automatically without requiring a source URL", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain('mode === "automatic"');
    expect(route).toContain("processCompanyDirectoryDiscoveryQueue");
    expect(route).toContain("COMPANY_DIRECTORY_SYNC_ENABLED");
  });

  it("discovers only from the official bulk source and prefilters the pilot scope", () => {
    const worker = source("scripts/company-directory-discovery.py");

    expect(worker).toContain("https-metadata-bolagsverket-se-store-2-resource-41");
    expect(worker).toContain('ALLOWED_HOST = "bolagsverket.se"');
    expect(worker).toContain("PILOT_LOCATIONS");
    expect(worker).toContain('digits == "81210"');
    expect(worker).toContain('digits == "43210"');
    expect(worker).toContain("sqlite3");
    expect(worker).toContain("Official records scanned");
  });

  it("schedules discovery separately from queue processing", () => {
    const workflow = source(".github/workflows/company-directory-automation.yml");

    expect(workflow).toContain("Discover official company candidates");
    expect(workflow).toContain("Verify and build queued company profiles");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain("company-directory-discovery-ingest");
    expect(workflow).toContain("company-directory-sync");
  });
});
