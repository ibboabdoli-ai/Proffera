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

import { revalidateAllCompanyDirectoryBatch } from "../src/lib/company-directory-full-revalidation";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const READY_PROFILE_ID = "41000000-0000-4000-8000-000000000001";
const REVIEW_PROFILE_ID = "41000000-0000-4000-8000-000000000002";
const READY_ORG = "5594022609";
const REVIEW_ORG = "9697794064";
const DETERMINISTIC_SCB_ERROR = "SCB company registry response must contain exactly one matching company";

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
  "full Directory hard-block and SCB quarantine PostgreSQL integration",
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

    async function seedProfile(input: {
      id: string;
      organizationNumber: string;
      status: "ready" | "review";
      procedures?: unknown[];
    }) {
      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, legal_name, display_name, public_slug, publication_status,
          country_code, organization_kind, category_slug, primary_sni_code,
          activity_description, is_active, privacy_blocked, auto_public_eligible,
          claimed_workspace_id, last_synced_at, updated_at
        ) values (
          $1::uuid, $2, 'Example AB', 'Example AB', $3, $4,
          'SE', 'juridical_person', 'bygg', '43.320',
          'Byggverksamhet', true, false, true,
          null, now() - interval '1 day', now() - interval '1 day'
        )
      `, [input.id, input.organizationNumber, `example-${input.organizationNumber}`, input.status]);

      await client!.query(`
        insert into company_directory_official_facts (
          profile_id, source_payload_hash, last_synced_at, ongoing_procedures
        ) values ($1::uuid, 'fresh-facts', now(), $2::jsonb)
      `, [input.id, JSON.stringify(input.procedures ?? [])]);
    }

    beforeAll(async () => {
      containerName = `proffera-hard-block-scb-${process.pid}-${Date.now()}`;
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
          public_slug text not null,
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
          last_synced_at timestamptz not null default now(),
          registered_names jsonb not null default '[]'::jsonb,
          sni_codes jsonb not null default '[]'::jsonb,
          deregistration_date timestamptz,
          advertising_blocked boolean,
          ongoing_procedures jsonb not null default '[]'::jsonb
        );
        create table company_directory_scb_enrichment (
          profile_id uuid primary key,
          organization_number text not null,
          observed_company_name text not null default '',
          phone text not null default '',
          email text not null default '',
          postal_address jsonb not null default '{}'::jsonb,
          municipality text not null default '',
          sni_codes jsonb not null default '[]'::jsonb,
          workplaces jsonb not null default '[]'::jsonb,
          provenance jsonb not null default '{}'::jsonb,
          conflicts jsonb not null default '[]'::jsonb,
          source_payload_hash text not null default '',
          last_synced_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table company_directory_discovery_queue (
          profile_id uuid,
          country_code text,
          organization_number text,
          state text not null
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
      mocks.enrichOfficialFacts.mockResolvedValue({
        profileId: READY_PROFILE_ID,
        organizationNumber: READY_ORG,
        reusedVerifiedDetail: false,
      });
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
    });

    it("demotes a Ready bankruptcy row without calling SCB", async () => {
      await seedProfile({
        id: READY_PROFILE_ID,
        organizationNumber: READY_ORG,
        status: "ready",
        procedures: [{ code: "KK", label: "Konkurs", fromDate: "2026-08-04" }],
      });
      mocks.enrichScb.mockRejectedValue(new Error("SCB must not be called"));

      const result = await revalidateAllCompanyDirectoryBatch(10);
      expect(result).toMatchObject({ selected: 1, movedToReview: 1, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const row = await client!.query<{ publication_status: string }>(
        "select publication_status from company_directory_profiles where id=$1::uuid",
        [READY_PROFILE_ID],
      );
      expect(row.rows[0]?.publication_status).toBe("review");
    }, 30_000);

    it("demotes a Ready legal block even when SCB transport is unavailable", async () => {
      await seedProfile({
        id: READY_PROFILE_ID,
        organizationNumber: READY_ORG,
        status: "ready",
        procedures: [{ code: "KK", label: "Konkurs", fromDate: "2026-08-04" }],
      });
      mocks.createScbTransport.mockReturnValue(null);

      const result = await revalidateAllCompanyDirectoryBatch(10);
      expect(result).toMatchObject({
        skipped: true,
        reason: "scb_access_not_configured",
        selected: 1,
        movedToReview: 1,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const row = await client!.query<{ publication_status: string }>(
        "select publication_status from company_directory_profiles where id=$1::uuid",
        [READY_PROFILE_ID],
      );
      expect(row.rows[0]?.publication_status).toBe("review");
    }, 30_000);

    it("quarantines deterministic SCB no-match for 24 hours after fail-closed Ready-to-Review", async () => {
      await seedProfile({ id: READY_PROFILE_ID, organizationNumber: READY_ORG, status: "ready" });
      mocks.enrichScb.mockRejectedValue(new Error(DETERMINISTIC_SCB_ERROR));

      const first = await revalidateAllCompanyDirectoryBatch(10);
      expect(first).toMatchObject({ selected: 1, movedToReview: 1, errors: 0, remaining: 0 });

      const row = await client!.query<{
        publication_status: string;
        source_payload_hash: string;
        failure_code: string | null;
      }>(`
        select p.publication_status,
               s.source_payload_hash,
               s.provenance #>> '{revalidationFailure,code}' as failure_code
        from company_directory_profiles p
        join company_directory_scb_enrichment s on s.profile_id=p.id
        where p.id=$1::uuid
      `, [READY_PROFILE_ID]);
      expect(row.rows[0]).toMatchObject({
        publication_status: "review",
        source_payload_hash: "",
        failure_code: "company_match_count",
      });

      mocks.enrichOfficialFacts.mockClear();
      mocks.enrichScb.mockClear();
      const second = await revalidateAllCompanyDirectoryBatch(10);
      expect(second).toMatchObject({ selected: 0, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);

    it("does not reselect a fresh hard-blocked Review row solely for missing SCB", async () => {
      await seedProfile({
        id: REVIEW_PROFILE_ID,
        organizationNumber: REVIEW_ORG,
        status: "review",
        procedures: [{ code: "FUOL", label: "Överlåtande i fusion", fromDate: "2026-05-04" }],
      });

      const result = await revalidateAllCompanyDirectoryBatch(10);
      expect(result).toMatchObject({ selected: 0, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);

    it("rechecks a hard-blocked Review row after 24 hours and skips SCB while the block persists", async () => {
      await seedProfile({
        id: REVIEW_PROFILE_ID,
        organizationNumber: REVIEW_ORG,
        status: "review",
        procedures: [{ code: "FUOL", label: "Överlåtande i fusion", fromDate: "2026-05-04" }],
      });
      await client!.query(
        "update company_directory_profiles set updated_at=now()-interval '2 days' where id=$1::uuid",
        [REVIEW_PROFILE_ID],
      );
      await client!.query(
        "update company_directory_official_facts set last_synced_at=now()-interval '2 days' where profile_id=$1::uuid",
        [REVIEW_PROFILE_ID],
      );
      mocks.enrichOfficialFacts.mockImplementation(async () => {
        await client!.query(
          "update company_directory_official_facts set last_synced_at=now() where profile_id=$1::uuid",
          [REVIEW_PROFILE_ID],
        );
        return {
          profileId: REVIEW_PROFILE_ID,
          organizationNumber: REVIEW_ORG,
          reusedVerifiedDetail: false,
        };
      });
      mocks.enrichScb.mockRejectedValue(new Error("SCB must not be called while the legal block persists"));

      const first = await revalidateAllCompanyDirectoryBatch(10);
      expect(first).toMatchObject({
        selected: 1,
        refreshed: 1,
        kept: 1,
        movedToReview: 0,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      mocks.enrichOfficialFacts.mockClear();
      const second = await revalidateAllCompanyDirectoryBatch(10);
      expect(second).toMatchObject({ selected: 0, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);
  },
);
