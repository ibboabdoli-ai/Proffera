import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20260821_0056_company_directory_projection_repairs.sql"),
  "utf8",
);

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Company Directory projection repair PostgreSQL contract",
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

    async function resetSchema() {
      await client!.query(`
        drop table if exists company_directory_profile_services cascade;
        drop table if exists company_directory_services cascade;
        drop table if exists company_directory_service_categories cascade;
        drop table if exists company_directory_field_sources cascade;
        drop table if exists company_directory_scb_enrichment cascade;
        drop table if exists company_directory_profiles cascade;

        create extension if not exists pgcrypto;

        create table company_directory_profiles (
          id uuid primary key,
          country_code text not null default 'SE',
          organization_number text not null,
          primary_sni_code text not null default '',
          municipality text not null default '',
          publication_status text not null default 'ready',
          updated_at timestamptz not null default now()
        );

        create table company_directory_scb_enrichment (
          profile_id uuid primary key references company_directory_profiles(id) on delete cascade,
          organization_number text not null,
          municipality text not null default ''
        );

        create table company_directory_field_sources (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid not null references company_directory_profiles(id) on delete cascade,
          field_name text not null,
          source_name text not null,
          source_record_id text not null default '',
          source_url text not null default '',
          value_hash text not null default '',
          confidence smallint not null default 100,
          observed_at timestamptz not null default now(),
          created_at timestamptz not null default now()
        );

        create unique index company_directory_field_sources_value_unique_idx
          on company_directory_field_sources (profile_id, field_name, source_name, value_hash);

        create table company_directory_service_categories (
          slug text primary key,
          label text not null,
          search_aliases text[] not null default '{}',
          sort_order smallint not null default 0,
          is_active boolean not null default true,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table company_directory_services (
          slug text primary key,
          category_slug text not null references company_directory_service_categories(slug) on delete restrict,
          parent_service_slug text references company_directory_services(slug) on delete restrict,
          label text not null,
          search_aliases text[] not null default '{}',
          sort_order smallint not null default 0,
          is_active boolean not null default true,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table company_directory_profile_services (
          profile_id uuid not null references company_directory_profiles(id) on delete cascade,
          service_slug text not null references company_directory_services(slug) on delete restrict,
          source_type text not null default 'sni',
          confidence smallint not null default 80,
          is_primary boolean not null default false,
          is_active boolean not null default true,
          public_visible boolean not null default true,
          confirmed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          primary key (profile_id, service_slug)
        );
      `);
    }

    beforeAll(async () => {
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

    it("executes twice while preserving profile state and repairing only the intended projections", async () => {
      await resetSchema();

      const blankProfile = "11111111-1111-4111-8111-111111111111";
      const existingProfile = "22222222-2222-4222-8222-222222222222";
      const unrelatedProfile = "33333333-3333-4333-8333-333333333333";
      const fixedUpdatedAt = "2026-08-21T20:00:00.000Z";

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, primary_sni_code, municipality, publication_status, updated_at
        ) values
          ($1, '5563115707', '96.210', '', 'ready', $4),
          ($2, '5563115708', '96.210', 'Stockholm', 'published', $4),
          ($3, '5563115709', '43.210', '', 'review', $4);

        insert into company_directory_scb_enrichment (profile_id, organization_number, municipality) values
          ($1, '5563115707', 'Södertälje'),
          ($2, '5563115708', 'Södertälje'),
          ($3, '5563115709', 'Stockholm');

        insert into company_directory_service_categories (slug, label) values
          ('legacy', 'Legacy');

        insert into company_directory_services (slug, category_slug, label) values
          ('legacy-sni', 'legacy', 'Legacy SNI'),
          ('owner-service', 'legacy', 'Owner service');

        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible
        ) values
          ($1, 'legacy-sni', 'sni', 85, true, true, true),
          ($1, 'owner-service', 'owner', 100, true, true, true);
      `, [blankProfile, existingProfile, unrelatedProfile, fixedUpdatedAt]);

      const before = await client!.query<{
        id: string;
        publication_status: string;
        updated_at: string;
      }>(`
        select id::text, publication_status, updated_at::text
        from company_directory_profiles
        order by id
      `);

      await expect(client!.query(migration)).resolves.toBeDefined();
      await expect(client!.query(migration)).resolves.toBeDefined();

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
          municipality: "",
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
      expect(provenance.rows).toEqual([{
        profile_id: blankProfile,
        field_name: "municipality",
        source_name: "scb_foretagsregistret",
        source_record_id: "5563115707",
      }]);

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
        provenance_count: 1,
      });
    }, 30_000);
  },
);
