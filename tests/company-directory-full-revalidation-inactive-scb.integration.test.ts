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

const PROFILE_ID = "30000000-0000-4000-8000-000000000001";
const ORGANIZATION_NUMBER = "5569461436";
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
  "full Directory revalidation inactive SCB eligibility PostgreSQL integration",
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

    async function seedInactiveProfile() {
      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, legal_name, display_name, publication_status,
          country_code, organization_kind, category_slug, primary_sni_code,
          activity_description, is_active, privacy_blocked, auto_public_eligible,
          claimed_workspace_id, last_synced_at, updated_at
        ) values (
          $1::uuid, $2, 'Inactive Example AB', 'Inactive Example AB', 'inactive',
          'SE', 'juridical_person', 'elektriker', '43.210',
          'Elinstallation och service', false, false, false,
          null, now() - interval '1 day', now() - interval '1 day'
        )
      `, [PROFILE_ID, ORGANIZATION_NUMBER]);
    }

    beforeAll(async () => {
      containerName = `proffera-inactive-scb-${process.pid}-${Date.now()}`;
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
          deregistration_date date,
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
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
    });

    it("selects stale Official Facts for inactive profiles and drains the item without SCB", async () => {
      await seedInactiveProfile();
      await client!.query(`
        insert into company_directory_official_facts (profile_id, source_payload_hash, last_synced_at)
        values ($1::uuid, 'stale-facts', now() - interval '2 days')
      `, [PROFILE_ID]);

      mocks.enrichOfficialFacts.mockImplementation(async (profileId: string) => {
        await client!.query(`
          update company_directory_official_facts
          set source_payload_hash = 'fresh-facts', last_synced_at = now()
          where profile_id = $1::uuid
        `, [profileId]);
        return { profileId, organizationNumber: ORGANIZATION_NUMBER, reusedVerifiedDetail: false };
      });

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        selected: 1,
        refreshed: 1,
        kept: 1,
        deferred: 0,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledWith(PROFILE_ID);
      expect(mocks.enrichScb).not.toHaveBeenCalled();
      expect(mocks.assessConfidence).not.toHaveBeenCalled();
    }, 30_000);

    it("does not select an inactive profile solely because its SCB snapshot is stale", async () => {
      await seedInactiveProfile();
      await client!.query(`
        insert into company_directory_official_facts (profile_id, source_payload_hash, last_synced_at)
        values ($1::uuid, 'fresh-facts', now())
      `, [PROFILE_ID]);
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, source_payload_hash, last_synced_at, provenance
        ) values (
          $1::uuid, 'stale-scb', now() - interval '8 days', '{}'::jsonb
        )
      `, [PROFILE_ID]);

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        selected: 0,
        refreshed: 0,
        kept: 0,
        deferred: 0,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();
      expect(mocks.assessConfidence).not.toHaveBeenCalled();
    }, 30_000);
  },
);
