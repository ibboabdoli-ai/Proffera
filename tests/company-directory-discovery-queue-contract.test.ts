import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("automatic company directory discovery contract", () => {
  it("uses a durable idempotent queue with leases and official detail verification", () => {
    const migration = source("db/migrations/20260810_0043_company_profile_discovery_queue.sql");
    const primarySniMigration = source("db/migrations/20260813_0047_company_directory_discovery_primary_sni.sql");
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(migration).toContain("company_directory_source_snapshots");
    expect(migration).toContain("company_directory_discovery_queue");
    expect(migration).toContain("company_directory_discovery_country_org_unique_idx");
    expect(migration).toContain("lock_token");
    expect(primarySniMigration).toContain("add column if not exists primary_sni_code");
    expect(queue).toContain("primary_sni_code");
    expect(queue).toContain("primarySniVerified: false");
    expect(queue).toContain("company_directory_discovery_queue.primary_sni_code <> excluded.primary_sni_code");
    expect(queue).toContain("company_directory_discovery_queue.state <> 'claimed'");
    expect(queue).toContain("for update skip locked");
    expect(queue).toContain("LEASE_MINUTES = 15");
    expect(queue).toContain("MAX_ATTEMPTS = 5");
    expect(queue).toContain("detailVerificationConfigured");
    expect(queue).toContain("Automatic discovery requires official detail verification and credentials");
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
    expect(route).toContain("payload.candidates");
  });

  it("processes the durable queue automatically without requiring a source URL", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain('mode === "automatic"');
    expect(route).toContain("processCompanyDirectoryDiscoveryQueue");
    expect(route).toContain("COMPANY_DIRECTORY_SYNC_ENABLED");
  });

  it("discovers only from the current official SCB bulk source and prefilters primary service and legal-form scope", () => {
    const worker = source("scripts/company-directory-discovery.py");

    expect(worker).toContain("https-metadata-bolagsverket-se-store-2-resource-76");
    expect(worker).toContain('DEFAULT_PROVIDER = "scb_hvd_bulk"');
    expect(worker).toContain('ALLOWED_HOST = "bolagsverket.se"');
    expect(worker).toContain("is_allowed_scb_bulk_url");
    expect(worker).toContain('/scb/scb_bulkfil.zip');
    expect(worker).toContain("SCB_ORG_KEYS");
    expect(worker).toContain('SCB_SNI_KEYS = {"ng1"}');
    expect(worker).toContain('"primarySniCode": str(row[1])');
    expect(worker).toContain("Ng2-Ng5 are secondary activities");
    expect(worker).toContain("SCB_LEGAL_FORM_KEYS");
    expect(worker).toContain("LEGAL_FORM_PRIORITY");
    expect(worker).toContain('"49": 0');
    expect(worker).toContain('"96": 4');
    expect(worker).toContain("PILOT_LOCATIONS");
    expect(worker).toContain('digits == "81210"');
    expect(worker).toContain('digits == "81221"');
    expect(worker).not.toContain('digits.startswith("8122")');
    expect(worker).toContain('digits == "43210"');
    expect(worker).toContain("legal_form_priority < ?");
    expect(worker).toContain("order by legal_form_priority asc");
    expect(worker).toContain("RANGE_SEGMENT_BYTES");
    expect(worker).toContain("sqlite3");
    expect(worker).toContain("Official SCB records scanned");
    expect(worker).toContain("primary-supported-SNI + supported-form candidates");
  });

  it("pauses scheduled queue processing while official facts catch up", () => {
    const workflow = source(".github/workflows/company-directory-automation.yml");

    expect(workflow).toContain("Discover official company candidates");
    expect(workflow).toContain("Enrich official company facts");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain("company-directory-discovery-ingest");
    expect(workflow).toContain("company-directory-official-facts?limit=10");
    expect(workflow).not.toContain("company-directory-sync");
  });

  it("allows only one targeted new-company pilot while regular profile processing is paused", () => {
    const route = source("src/app/api/cron/company-directory-pilot/route.ts");
    const workflow = source(".github/workflows/company-directory-pilot.yml");
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("processNewCompanyDirectoryDiscoveryQueueCandidate");
    expect(route).toContain("enrichCompanyDirectoryOfficialFactsForProfile");
    expect(route).toContain("organization_number");
    expect(route).toContain("A 10-digit organization_number is required");
    expect(route).toContain('COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() !== "automatic"');
    expect(route).toContain('COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true"');
    expect(route).toContain('COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() === "true"');
    expect(route).toContain("Pilot processing requires automatic publishing to remain disabled");
    expect(queue).toContain("processNewCompanyDirectoryDiscoveryQueueCandidate");
    expect(queue).toContain("requireUnprofiled: true");
    expect(queue).toContain("queue.primary_sni_code <> ''");
    expect(queue).toContain("not exists (");
    expect(source("src/lib/company-directory-official-facts.ts")).toContain("enrichCompanyDirectoryOfficialFactsForProfile");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("organization_number:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("Process one new company directory candidate");
    expect(workflow).toContain("/api/cron/company-directory-pilot");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
  });
});
