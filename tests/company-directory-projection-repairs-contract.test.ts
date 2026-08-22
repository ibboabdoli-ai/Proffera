import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const BASELINE_MIGRATION_PATHS = [
  "db/migrations/20260809_0037_company_profile_engine_foundation.sql",
  "db/migrations/20260809_0038_company_profile_engine_provenance.sql",
  "db/migrations/20260812_0044_company_directory_official_facts.sql",
  "db/migrations/20260813_0045_company_directory_service_location_foundation.sql",
  "db/migrations/20260819_0048_company_directory_scb_enrichment.sql",
] as const;

const REPAIR_MIGRATION_PATH =
  "db/migrations/20260821_0056_company_directory_projection_repairs.sql";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Company Directory projection repair PostgreSQL contract",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;
    let repairMigration = "";

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

    async function resetSchemaFromCommittedMigrations() {
      await client!.query("drop schema public cascade; create schema public");

      // Directory migration 0037 references workspaces. The workspace table is an
      // external prerequisite, not part of the Directory schema under test.
      await client!.query("create table workspaces (id uuid primary key)");

      for (const migrationPath of BASELINE_MIGRATION_PATHS) {
        const migration = readFileSync(join(process.cwd(), migrationPath), "utf8");
        await client!.query(migration);
      }
    }

    beforeAll(async () => {
      repairMigration = readFileSync(join(process.cwd(), REPAIR_MIGRATION_PATH), "utf8");

      containerName = `proffera-directory-projection-${process.pid}-${Date.now()}`;
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

    it("executes twice on the committed schema while preserving profile state", async () => {
      await resetSchemaFromCommittedMigrations();

      const blankProfile = "11111111-1111-4111-8111-111111111111";
      const existingProfile = "22222222-2222-4222-8222-222222222222";
      const unrelatedProfile = "33333333-3333-4333-8333-333333333333";
      const fixedUpdatedAt = "2026-08-21T20:00:00.000Z";

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, primary_sni_code, municipality, publication_status,
          is_active, auto_public_eligible, quality_score, city, category_slug, updated_at
        ) values
          (
            $1, '5563115707', 'juridical_person', 'Blank Municipality AB', 'Blank Municipality AB',
            'blank-municipality-ab', '96.210', '', 'ready',
            false, false, 95, 'Södertälje', 'frisor', $4
          ),
          (
            $2, '5563115708', 'juridical_person', 'Existing Municipality AB', 'Existing Municipality AB',
            'existing-municipality-ab', '96.210', 'Stockholm', 'published',
            true, true, 100, 'Stockholm', 'frisor', $4
          ),
          (
            $3, '5563115709', 'juridical_person', 'Unrelated Electric AB', 'Unrelated Electric AB',
            'unrelated-electric-ab', '43.210', '', 'review',
            true, false, 95, 'Stockholm', 'elektriker', $4
          )
      `, [blankProfile, existingProfile, unrelatedProfile, fixedUpdatedAt]);

      await client!.query(`
        insert into company_directory_scb_enrichment (profile_id, organization_number, municipality) values
          ($1, '5563115707', 'Södertälje'),
          ($2, '5563115708', 'Södertälje'),
          ($3, '5563115709', 'Stockholm')
      `, [blankProfile, existingProfile, unrelatedProfile]);

      await client!.query(`
        insert into company_directory_service_categories (slug, label) values
          ('legacy', 'Legacy')
        on conflict (slug) do nothing
      `);

      await client!.query(`
        insert into company_directory_services (slug, category_slug, label) values
          ('legacy-sni', 'legacy', 'Legacy SNI'),
          ('owner-service', 'legacy', 'Owner service')
        on conflict (slug) do nothing
      `);

      await client!.query(`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible
        ) values
          ($1, 'legacy-sni', 'sni', 85, true, true, true),
          ($1, 'owner-service', 'owner', 100, true, true, true)
      `, [blankProfile]);

      const productionConstraints = await client!.query<{ conname: string }>(`
        select conname
        from pg_constraint
        where conrelid = 'company_directory_profile_services'::regclass
        order by conname
      `);
      expect(productionConstraints.rows.map((row) => row.conname)).toEqual(expect.arrayContaining([
        "company_directory_profile_services_source_check",
        "company_directory_profile_services_confidence_check",
      ]));

      const provenanceIndexBefore = await client!.query<{ index_name: string | null }>(`
        select to_regclass('public.company_directory_field_sources_value_unique_idx')::text as index_name
      `);
      expect(provenanceIndexBefore.rows[0]?.index_name).toBe(
        "company_directory_field_sources_value_unique_idx",
      );

      const before = await client!.query<{
        id: string;
        publication_status: string;
        updated_at: string;
      }>(`
        select id::text, publication_status, updated_at::text
        from company_directory_profiles
        order by id
      `);

      await expect(client!.query(repairMigration)).resolves.toBeDefined();
      await expect(client!.query(repairMigration)).resolves.toBeDefined();

      const pgcrypto = await client!.query<{ extname: string }>(`
        select extname from pg_extension where extname = 'pgcrypto'
      `);
      expect(pgcrypto.rows).toEqual([{ extname: "pgcrypto" }]);

      const profiles = await client!.query<{
        id: string;
        municipality: string;
        publication_status: string;
        updated_at: string;
      }>(`
        select id::text, municipality, publication_status, updated_at::text
        from company_directory_profiles
        order by id
      `);

      expect(profiles.rows).toEqual([
        expect.objectContaining({
          id: blankProfile,
          municipality: "Södertälje",
          publication_status: "ready",
          updated_at: before.rows[0]?.updated_at,
        }),
        expect.objectContaining({
          id: existingProfile,
          municipality: "Stockholm",
          publication_status: "published",
          updated_at: before.rows[1]?.updated_at,
        }),
        expect.objectContaining({
          id: unrelatedProfile,
          municipality: "Stockholm",
          publication_status: "review",
          updated_at: before.rows[2]?.updated_at,
        }),
      ]);

      const frisorService = await client!.query<{
        slug: string;
        label: string;
        category_slug: string;
        is_active: boolean;
      }>(`
        select slug, label, category_slug, is_active
        from company_directory_services
        where slug = 'frisor'
      `);
      expect(frisorService.rows).toEqual([{
        slug: "frisor",
        label: "Frisör / Barberare",
        category_slug: "frisor",
        is_active: true,
      }]);

      const frisorRelations = await client!.query<{
        profile_id: string;
        source_type: string;
        is_primary: boolean;
        is_active: boolean;
        public_visible: boolean;
      }>(`
        select profile_id::text, source_type, is_primary, is_active, public_visible
        from company_directory_profile_services
        where service_slug = 'frisor'
        order by profile_id
      `);
      expect(frisorRelations.rows).toEqual([
        {
          profile_id: blankProfile,
          source_type: "sni",
          is_primary: true,
          is_active: true,
          public_visible: true,
        },
        {
          profile_id: existingProfile,
          source_type: "sni",
          is_primary: true,
          is_active: true,
          public_visible: true,
        },
      ]);

      const legacyRelations = await client!.query<{
        service_slug: string;
        source_type: string;
        is_primary: boolean;
        is_active: boolean;
      }>(`
        select service_slug, source_type, is_primary, is_active
        from company_directory_profile_services
        where profile_id = $1
          and service_slug in ('legacy-sni', 'owner-service')
        order by service_slug
      `, [blankProfile]);
      expect(legacyRelations.rows).toEqual([
        {
          service_slug: "legacy-sni",
          source_type: "sni",
          is_primary: false,
          is_active: false,
        },
        {
          service_slug: "owner-service",
          source_type: "owner",
          is_primary: true,
          is_active: true,
        },
      ]);

      const provenance = await client!.query<{
        profile_id: string;
        field_name: string;
        source_name: string;
        source_record_id: string;
      }>(`
        select profile_id::text, field_name, source_name, source_record_id
        from company_directory_field_sources
        where field_name = 'municipality'
        order by profile_id
      `);
      expect(provenance.rows).toEqual([
        {
          profile_id: blankProfile,
          field_name: "municipality",
          source_name: "scb_foretagsregistret",
          source_record_id: "5563115707",
        },
        {
          profile_id: unrelatedProfile,
          field_name: "municipality",
          source_name: "scb_foretagsregistret",
          source_record_id: "5563115709",
        },
      ]);

      const counts = await client!.query<{
        service_count: number;
        relation_count: number;
        provenance_count: number;
      }>(`
        select
          (select count(*)::int from company_directory_services where slug = 'frisor') as service_count,
          (select count(*)::int from company_directory_profile_services where service_slug = 'frisor') as relation_count,
          (select count(*)::int from company_directory_field_sources where field_name = 'municipality') as provenance_count
      `);
      expect(counts.rows[0]).toEqual({
        service_count: 1,
        relation_count: 2,
        provenance_count: 2,
      });
    }, 30_000);
  },
);
