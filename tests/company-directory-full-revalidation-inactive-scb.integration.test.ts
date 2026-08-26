import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
const ACTIVE_PROFILE_ID = "30000000-0000-4000-8000-000000000002";
const ACTIVE_ORGANIZATION_NUMBER = "5560360793";
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

    async function seedProfile(input: {
      id: string;
      organizationNumber: string;
      publicSlug: string;
      publicationStatus: "inactive" | "published";
      isActive: boolean;
      autoPublicEligible: boolean;
    }) {
      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, legal_name, display_name, public_slug, publication_status,
          country_code, organization_kind, category_slug, primary_sni_code,
          activity_description, is_active, privacy_blocked, auto_public_eligible,
          claimed_workspace_id, last_synced_at, updated_at
        ) values (
          $1::uuid, $2, $3, $3, $4, $5,
          'SE', 'juridical_person', 'elektriker', '43.210',
          'Elinstallation och service', $6, false, $7,
          null, now() - interval '1 day', now() - interval '1 day'
        )
      `, [
        input.id,
        input.organizationNumber,
        input.publicationStatus === "inactive" ? "Inactive Example AB" : "Active Example AB",
        input.publicSlug,
        input.publicationStatus,
        input.isActive,
        input.autoPublicEligible,
      ]);
    }

    async function seedInactiveProfile() {
      await seedProfile({
        id: PROFILE_ID,
        organizationNumber: ORGANIZATION_NUMBER,
        publicSlug: "inactive-example-ab",
        publicationStatus: "inactive",
        isActive: false,
        autoPublicEligible: false,
      });
    }

    async function seedActiveProfile() {
      await seedProfile({
        id: ACTIVE_PROFILE_ID,
        organizationNumber: ACTIVE_ORGANIZATION_NUMBER,
        publicSlug: "active-example-ab",
        publicationStatus: "published",
        isActive: true,
        autoPublicEligible: true,
      });
    }

    async function seedFreshFacts(profileId: string) {
      await client!.query(`
        insert into company_directory_official_facts (profile_id, source_payload_hash, last_synced_at)
        values ($1::uuid, 'fresh-facts', now())
      `, [profileId]);
    }

    async function seedStaleScb(profileId: string, organizationNumber: string) {
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, source_payload_hash, last_synced_at, provenance
        ) values (
          $1::uuid, $2, 'stale-scb', now() - interval '8 days', '{}'::jsonb
        )
      `, [profileId, organizationNumber]);
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
          source_payload_hash text not null default '',
          last_synced_at timestamptz not null default now(),
          provenance jsonb not null default '{}'::jsonb,
          conflicts jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        );
        create table company_directory_discovery_queue (
          profile_id uuid,
          country_code text,
          organization_number text,
          state text not null,
          last_error text not null default '',
          next_attempt_at timestamptz not null default now()
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
      mocks.enrichOfficialFacts.mockImplementation(async (profileId: string) => ({
        profileId,
        organizationNumber: profileId === ACTIVE_PROFILE_ID ? ACTIVE_ORGANIZATION_NUMBER : ORGANIZATION_NUMBER,
        reusedVerifiedDetail: false,
      }));
      mocks.enrichScb.mockImplementation(async (profileId: string) => {
        await client!.query(`
          update company_directory_scb_enrichment scb
          set source_payload_hash = 'fresh-scb',
              last_synced_at = now(),
              provenance = jsonb_build_object(
                'comparisonSnapshot',
                jsonb_build_object(
                  'profileUpdatedToken', (
                    select profile.updated_at::text
                    from company_directory_profiles profile
                    where profile.id = $1::uuid
                  ),
                  'officialFactsLastSyncedToken', (
                    select facts.last_synced_at::text
                    from company_directory_official_facts facts
                    where facts.profile_id = $1::uuid
                  )
                )
              ),
              updated_at = now()
          where scb.profile_id = $1::uuid
        `, [profileId]);
        return { status: "saved", saved: true, conflicts: [] };
      });
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
    });

    it("keeps reviewed fixture columns aligned with the canonical migrations", async () => {
      const profileMigration = readFileSync(
        new URL("../db/migrations/20260809_0037_company_profile_engine_foundation.sql", import.meta.url),
        "utf8",
      );
      const factsMigration = readFileSync(
        new URL("../db/migrations/20260812_0044_company_directory_official_facts.sql", import.meta.url),
        "utf8",
      );
      const scbMigration = readFileSync(
        new URL("../db/migrations/20260819_0048_company_directory_scb_enrichment.sql", import.meta.url),
        "utf8",
      );

      expect(profileMigration).toContain("public_slug text not null");
      expect(factsMigration).toContain("deregistration_date timestamptz");
      expect(scbMigration).toContain("organization_number text not null");

      const schema = await client!.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(`
        select table_name, column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and (
            (table_name = 'company_directory_profiles' and column_name = 'public_slug')
            or (table_name = 'company_directory_official_facts' and column_name = 'deregistration_date')
            or (table_name = 'company_directory_scb_enrichment' and column_name = 'organization_number')
          )
      `);
      const columns = new Map(
        schema.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
      );

      expect(columns.get("company_directory_profiles.public_slug")).toMatchObject({
        data_type: "text",
        is_nullable: "NO",
      });
      expect(columns.get("company_directory_official_facts.deregistration_date")).toMatchObject({
        data_type: "timestamp with time zone",
        is_nullable: "YES",
      });
      expect(columns.get("company_directory_scb_enrichment.organization_number")).toMatchObject({
        data_type: "text",
        is_nullable: "NO",
      });
    }, 30_000);

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
      await seedFreshFacts(PROFILE_ID);
      await seedStaleScb(PROFILE_ID, ORGANIZATION_NUMBER);

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

    it("keeps stale-SCB revalidation active for published profiles while excluding inactive profiles", async () => {
      await seedInactiveProfile();
      await seedFreshFacts(PROFILE_ID);
      await seedStaleScb(PROFILE_ID, ORGANIZATION_NUMBER);

      await seedActiveProfile();
      await seedFreshFacts(ACTIVE_PROFILE_ID);
      await seedStaleScb(ACTIVE_PROFILE_ID, ACTIVE_ORGANIZATION_NUMBER);

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        selected: 1,
        refreshed: 1,
        kept: 1,
        deferred: 0,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledWith(ACTIVE_PROFILE_ID);
      expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb.mock.calls[0]?.[0]).toBe(ACTIVE_PROFILE_ID);
      expect(mocks.enrichScb.mock.calls.some((call) => call[0] === PROFILE_ID)).toBe(false);
      expect(mocks.assessConfidence).toHaveBeenCalledTimes(1);
    }, 30_000);
  },
);
