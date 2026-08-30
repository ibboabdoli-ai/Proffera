import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { workflowCronExpressions, workflowTriggers } from "./github-workflow-yaml";

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
    expect(queue).toContain("company_directory_discovery_queue.state not in ('claimed', 'processing')");
    expect(queue).toContain("for update skip locked");
    expect(queue).toContain("LEASE_MINUTES = 15");
    expect(queue).toContain("MAX_ATTEMPTS = 5");
    expect(queue).toContain("detailVerificationConfigured");
    expect(queue).toContain("Automatic discovery requires official detail verification and credentials");
    expect(queue).toContain("verifyOfficialCompanyCandidate");
    expect(queue).toContain("upsertCompanyDirectoryCandidate");
    expect(queue).toContain("await enrichCompanyDirectoryOfficialFactsForProfile(result.profileId)");
  });

  it("preserves active leases when discovery changes and rejects stale worker completion", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(queue).toContain("discovery source changed during processing");
    expect(queue).toContain("source_fingerprint = ${input.sourceFingerprint}");
    expect(queue).toContain("primary_sni_code = ${input.primarySniCode}");
    expect(queue).toMatch(/attempt_count = case\s+when source_fingerprint = \$\{input\.sourceFingerprint\}/);
    expect(queue).toContain("returning profile_id::text,");
    expect(queue).toContain("source_unchanged");
    expect(queue).toContain("Directory queue source changed during processing");
  });

  it("keeps discovery ingest secret-protected and restricts lightweight source probes to official Bolagsverket URLs", () => {
    const route = source("src/app/api/cron/company-directory-discovery-ingest/route.ts");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain('process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() === "automatic"');
    expect(route).toContain('url.protocol !== "https:"');
    expect(route).toContain('host !== "bolagsverket.se"');
    expect(route).toContain('host.endsWith(".bolagsverket.se")');
    expect(route).toContain("MAX_ORGANIZATION_NUMBERS = 500");
    expect(route).toContain("payload.candidates");
    expect(route).toContain('SOURCE_PROBE_QUERY = "source_probe"');
    expect(route).toContain("company_directory_source_snapshots");
    expect(route).toContain('method: "HEAD"');
    expect(route).toContain('response.headers.get("last-modified")');
    expect(route).toContain("sourceChanged");
  });

  it("processes the durable queue automatically without a global Official Facts backlog gate", () => {
    const route = source("src/app/api/cron/company-directory-sync/route.ts");

    expect(route).toContain('mode === "automatic"');
    expect(route).toContain("processCompanyDirectoryDiscoveryQueue");
    expect(route).toContain("COMPANY_DIRECTORY_SYNC_ENABLED");
    expect(route).toContain("COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED");
    expect(route).not.toContain("getCompanyDirectoryOfficialFactsBacklog");
    expect(route).not.toContain("pendingOfficialFacts");
    expect(route).not.toContain("paused until Official Facts catch up");
  });

  it("discovers only from the current official SCB bulk source and prefilters primary service and legal-form scope", () => {
    const worker = source("scripts/company-directory-discovery.py");

    expect(worker).toContain(
      'DEFAULT_BULK_URL = "https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip"',
    );
    expect(worker).toContain("source_url = override.strip() or DEFAULT_BULK_URL");
    expect(worker).not.toContain("https-metadata-bolagsverket-se-store-2-resource-76");
    expect(worker).not.toContain("data.europa.eu/api/hub/search/datasets");
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

  it("probes official discovery hourly, keeps a daily full scan, and leaves queue processing on the Operations runner", () => {
    const discoveryWorkflow = source(".github/workflows/company-directory-automation.yml");
    const operationsWorkflow = source(".github/workflows/booking-reminders.yml");
    const discoveryTriggers = workflowTriggers(discoveryWorkflow);
    const operationsTriggers = workflowTriggers(operationsWorkflow);

    expect(discoveryWorkflow).toContain("Discover official company candidates");
    expect(workflowCronExpressions(discoveryWorkflow)).toEqual([
      "17 * * * *",
      "31 3 * * *",
    ]);
    expect(discoveryWorkflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(discoveryWorkflow).toContain("company-directory-discovery-ingest");
    expect(discoveryWorkflow).toContain("source_probe=1");
    expect(discoveryWorkflow).toContain("Probe official company source");
    expect(discoveryWorkflow).toContain("daily-safety-scan");
    expect(discoveryWorkflow).toContain("official-source-changed");
    expect(discoveryWorkflow).toContain("steps.scan.outputs.run_full == 'true'");
    expect(discoveryTriggers).toHaveProperty("push");
    expect(workflowCronExpressions(discoveryWorkflow)).not.toContain("9,24,39,54 * * * *");

    expect(operationsWorkflow).toContain("Process booking reminders and directory updates");
    expect(operationsTriggers).toHaveProperty("workflow_dispatch");
    expect(operationsTriggers).not.toHaveProperty("schedule");
    expect(operationsWorkflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(operationsWorkflow).toContain("company-directory-official-facts?limit=10");
    expect(operationsWorkflow).toContain("company-directory-sync");

    const bookingIndex = operationsWorkflow.indexOf('"Booking reminders"');
    const officialFactsIndex = operationsWorkflow.indexOf('"Company directory official facts"');
    const syncIndex = operationsWorkflow.indexOf('"Company directory sync"');
    expect(bookingIndex).toBeGreaterThan(-1);
    expect(officialFactsIndex).toBeGreaterThan(bookingIndex);
    expect(syncIndex).toBeGreaterThan(officialFactsIndex);

    expect(operationsWorkflow).toContain("failed=0");
    expect(operationsWorkflow).toContain("if ! curl --fail-with-body");
    expect(operationsWorkflow).toContain("failed=1");
    expect(operationsWorkflow).toContain('exit "$failed"');
  });

  it("allows only one targeted new-company pilot while regular profile processing is paused", () => {
    const route = source("src/app/api/cron/company-directory-pilot/route.ts");
    const workflow = source(".github/workflows/company-directory-pilot.yml");
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("processNewCompanyDirectoryDiscoveryQueueCandidate");
    expect(route).toContain("result.errors > 0");
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
    expect(queue).toContain('pilotRetryPrefix: "targeted pilot retry:"');
    expect(queue).toContain("requeueTargetedPilotItem");
    expect(queue).toContain("targetedPilotProfileId");
    expect(queue).toContain("enrichCompanyDirectoryOfficialFactsForProfile(result.profileId)");
    expect(source("src/lib/company-directory-official-facts.ts")).toContain("enrichCompanyDirectoryOfficialFactsForProfile");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("organization_number:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("Process one new company directory candidate");
    expect(workflow).toContain("/api/cron/company-directory-pilot");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain('RESPONSE_FILE="$(mktemp)"');
    expect(workflow).toContain('payload.get("skipped") is True');
    expect(workflow).toContain('payload.get("claimed") != 1 or payload.get("processed") != 1');
  });

  it("keeps the controlled batch pilot manual, capped, official-facts-first, and unpublished", () => {
    const route = source("src/app/api/cron/company-directory-batch-pilot/route.ts");
    const workflow = source(".github/workflows/company-directory-batch-pilot.yml");
    const queue = source("src/lib/company-directory-discovery-queue.ts");

    expect(route).toContain("const CONTROLLED_BATCH_SIZE = 5");
    expect(route).toContain("export const maxDuration = 300");
    expect(route).toContain("processNewCompanyDirectoryDiscoveryQueueBatch");
    expect(route).toContain("result.errors > 0");
    expect(route).toContain('COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true"');
    expect(route).toContain('COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() === "true"');
    expect(route).toContain("automatic publishing to remain disabled");
    expect(queue).toContain("controlled batch pilot retry:");
    expect(queue).toContain("enrichCompanyDirectoryOfficialFactsForProfile(result.profileId)");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("Process up to five new company directory candidates");
    expect(workflow).toContain("timeout-minutes: 8");
    expect(workflow).toContain("--max-time 330");
    expect(workflow).toContain("/api/cron/company-directory-batch-pilot");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
  });
});
