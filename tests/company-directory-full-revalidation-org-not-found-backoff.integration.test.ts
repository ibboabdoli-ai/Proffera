import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
  enrichOfficialFacts: vi.fn(),
  enrichScb: vi.fn(),
  createScbTransport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichOfficialFacts,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createScbTransport,
}));

import { BolagsverketOrganizationNotFoundError } from "../src/lib/company-directory-official-facts-errors";
import { revalidateAllCompanyDirectoryBatch } from "../src/lib/company-directory-full-revalidation";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const PROFILE_ID = "06316ff1-f162-4c26-b997-cb7aa2515b95";
const ORGANIZATION_NUMBER = "5592643778";
const BACKOFF_PREFIX = "full_revalidation:official_facts:organisation_not_found";
const INITIAL_ATTEMPT_COUNT = 4;
const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const result = await client.query(query, values);
    return result.rows;
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "full Directory deterministic Official Facts backoff PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

    async function waitForPostgres() {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          await probe.query("select 1");
          await probe.end();
          return;
        } catch (error) {
          lastError = error;
          await probe.end().catch(() => undefined);
          await delay(500);
        }
      }
      throw lastError ?? new Error("PostgreSQL test container did not become ready");
    }

    async function seedHardBlockedReview(withQueue = true) {
      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, legal_name, display_name, publication_status,
          country_code, organization_kind, category_slug, primary_sni_code,
          activity_description, is_active, privacy_blocked, auto_public_eligible,
          claimed_workspace_id, last_synced_at, updated_at
        ) values (
          $1::uuid, $2, 'Kleen hem i Stockholm AB', 'Kleen hem i Stockholm AB', 'review',
          'SE', 'juridical_person', 'stadning', '81.210',
          'Lokalvård', true, false, true,
          null, now() - interval '3 days', now() - interval '2 days'
        )
      `, [PROFILE_ID, ORGANIZATION_NUMBER]);

      await client!.query(`
        insert into company_directory_official_facts (
          profile_id, source_payload_hash, last_synced_at,
          registered_names, sni_codes, deregistration_date,
          advertising_blocked, ongoing_procedures
        ) values (
          $1::uuid, 'verified-hard-block', now() - interval '2 days',
          '[]'::jsonb, '[]'::jsonb, null,
          false, '[{"code":"FUOL","label":"Överlåtande i fusion","fromDate":"2026-08-01"}]'::jsonb
        )
      `, [PROFILE_ID]);

      if (withQueue) {
        await client!.query(`
          insert into company_directory_discovery_queue (
            profile_id, country_code, organization_number, state,
            attempt_count, next_attempt_at, last_error
          ) values (
            $1::uuid, 'SE', $2, 'review',
            $3, now() - interval '1 day', ''
          )
        `, [PROFILE_ID, ORGANIZATION_NUMBER, INITIAL_ATTEMPT_COUNT]);
      }
    }

    async function queueState() {
      const result = await client!.query<{
        state: string;
        attempt_count: number;
        last_error: string;
        next_attempt_at: Date;
      }>(`
        select state, attempt_count, last_error, next_attempt_at
        from company_directory_discovery_queue
        where profile_id = $1::uuid
      `, [PROFILE_ID]);
      return result.rows[0];
    }

    beforeAll(async () => {
      containerName = `proffera-org-not-found-backoff-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);

      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();

      await client.query(`
        create table company_directory_sync_runs (
          id uuid primary key default gen_random_uuid(),
          provider text not null,
          status text not null,
          cursor_value text not null default '',
          started_at timestamptz not null default now(),
          completed_at timestamptz,
          scanned_count integer not null default 0,
          upserted_count integer not null default 0,
          published_count integer not null default 0,
          blocked_count integer not null default 0,
          error_count integer not null default 0,
          error_summary text not null default ''
        );
        create table company_directory_profiles (
          id uuid primary key,
          organization_number text not null,
          legal_name text not null,
          display_name text not null,
          publication_status text not null,
          country_code text not null,
          organization_kind text not null,
          category_slug text not null,
          primary_sni_code text not null,
          activity_description text not null default '',
          is_active boolean not null default true,
          privacy_blocked boolean not null default false,
          auto_public_eligible boolean not null default true,
          claimed_workspace_id uuid,
          last_synced_at timestamptz not null,
          updated_at timestamptz not null,
          published_at timestamptz
        );
        create table company_directory_official_facts (
          profile_id uuid primary key,
          source_payload_hash text not null default '',
          last_synced_at timestamptz,
          registered_names jsonb not null default '[]'::jsonb,
          sni_codes jsonb not null default '[]'::jsonb,
          deregistration_date timestamptz,
          advertising_blocked boolean not null default false,
          ongoing_procedures jsonb not null default '[]'::jsonb
        );
        create table company_directory_scb_enrichment (
          profile_id uuid primary key,
          source_payload_hash text not null default '',
          last_synced_at timestamptz,
          provenance jsonb not null default '{}'::jsonb,
          conflicts jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        );
        create table company_directory_discovery_queue (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid,
          country_code text not null default 'SE',
          organization_number text not null,
          state text not null,
          attempt_count integer not null default 0,
          next_attempt_at timestamptz not null default now(),
          last_error text not null default '',
          locked_at timestamptz,
          lock_token uuid
        );
      `);
    }, 120_000);

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm can remove a failed container before cleanup.
        }
      }
    }, 30_000);

    beforeEach(async () => {
      await client!.query(`
        truncate table company_directory_discovery_queue,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_profiles,
          company_directory_sync_runs
      `);

      for (const mock of Object.values(mocks)) mock.mockReset();
      transport.fetchCompany.mockReset();
      transport.fetchWorkplaces.mockReset();

      mocks.getSql.mockReturnValue(postgresSql(client!));
      mocks.createScbTransport.mockReturnValue(transport);
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
      mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
    });

    it("persists a 7-day Review backoff, suppresses the next batch, and restores eligibility after expiry", async () => {
      await seedHardBlockedReview();
      mocks.enrichOfficialFacts.mockRejectedValue(new BolagsverketOrganizationNotFoundError(
        "Official facts lookup returned partial data: organisation.fel: ORGANISATION_FINNS_EJ",
      ));

      const first = await revalidateAllCompanyDirectoryBatch(10);
      expect(first).toMatchObject({
        selected: 1,
        refreshed: 0,
        kept: 1,
        deferred: 1,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const marked = await queueState();
      expect(marked).toBeDefined();
      expect(marked?.state).toBe("review");
      expect(marked?.attempt_count).toBe(INITIAL_ATTEMPT_COUNT);
      expect(marked?.last_error.startsWith(BACKOFF_PREFIX)).toBe(true);
      expect(marked?.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + (6 * 24 * 60 * 60 * 1000));

      const second = await revalidateAllCompanyDirectoryBatch(10);
      expect(second).toMatchObject({ selected: 0, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      await client!.query(`
        update company_directory_discovery_queue
        set next_attempt_at = now() - interval '1 second'
        where profile_id = $1::uuid
      `, [PROFILE_ID]);

      const afterExpiry = await revalidateAllCompanyDirectoryBatch(10);
      expect(afterExpiry).toMatchObject({ selected: 1, kept: 1, deferred: 1, errors: 0 });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(2);
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 45_000);

    it("does not quarantine transient Official Facts failures", async () => {
      await seedHardBlockedReview();
      mocks.enrichOfficialFacts.mockRejectedValue(new Error("Official facts lookup timed out"));

      const result = await revalidateAllCompanyDirectoryBatch(10);
      expect(result.errors).toBe(1);
      expect(result.errorSummary).toContain("Official facts lookup timed out");
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const queue = await queueState();
      expect(queue?.state).toBe("review");
      expect(queue?.attempt_count).toBe(INITIAL_ATTEMPT_COUNT);
      expect(queue?.last_error).toBe("");
      expect(queue?.next_attempt_at.getTime()).toBeLessThanOrEqual(Date.now());
    }, 30_000);

    it("fails closed when no durable Review queue row exists for the deterministic marker", async () => {
      await seedHardBlockedReview(false);
      mocks.enrichOfficialFacts.mockRejectedValue(new BolagsverketOrganizationNotFoundError(
        "ORGANISATION_FINNS_EJ",
      ));

      const result = await revalidateAllCompanyDirectoryBatch(10);
      expect(result.errors).toBe(1);
      expect(result.kept).toBe(0);
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);
  },
);
