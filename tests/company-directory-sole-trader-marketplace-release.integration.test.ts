import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  getDashboardWorkspaceServices: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));
vi.mock("@/lib/workspace-services-db", () => ({
  getDashboardWorkspaceServices: mocks.getDashboardWorkspaceServices,
}));

import { activateProviderMarketplaceService } from "../src/lib/company-directory-provider-activation";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const CLAIMED_PROFILE_ID = "55555555-5555-4555-8555-555555555555";
const CLAIM_ID = "44444444-4444-4444-8444-444444444444";
const SERVICE_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_SLUG = "fonsterputsning";

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
  "sole-trader Marketplace release PostgreSQL integration",
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

    beforeAll(async () => {
      containerName = `proffera-sole-trader-release-${process.pid}-${Date.now()}`;
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
        create table workspace_services (
          id uuid primary key,
          workspace_id uuid not null,
          name text not null,
          description text not null default '',
          category text not null default '',
          price_type text not null default 'quote',
          price_amount_minor integer,
          is_active boolean not null default true,
          sort_order integer not null default 100,
          public_slug text,
          primary_directory_service_slug text,
          public_status text not null default 'draft',
          conversion_mode text not null default 'quote',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table company_directory_profiles (
          id uuid primary key,
          country_code text not null default 'SE',
          claimed_workspace_id uuid,
          organization_number text not null,
          organization_kind text not null,
          legal_name text not null,
          display_name text not null,
          legal_form text not null default '',
          organization_status text not null default '',
          category_slug text not null default '',
          address_line1 text not null default '',
          postal_code text not null default '',
          city text not null default '',
          public_slug text not null,
          publication_status text not null,
          is_active boolean not null default true,
          privacy_blocked boolean not null default false,
          auto_public_eligible boolean not null default true,
          official_source text not null default '',
          published_at timestamptz,
          quality_reasons jsonb not null default '[]'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table company_directory_claims (
          id uuid primary key,
          profile_id uuid not null,
          claimant_user_id text not null,
          requested_workspace_id uuid,
          status text not null,
          verification_method text not null,
          verification_reference text not null default '',
          requested_at timestamptz not null default now(),
          verified_at timestamptz,
          resolved_at timestamptz
        );
        create table company_directory_services (
          slug text primary key,
          category_slug text not null,
          label text not null,
          is_active boolean not null default true,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table company_directory_profile_services (
          profile_id uuid not null,
          service_slug text not null,
          source_type text not null,
          confidence smallint not null,
          is_primary boolean not null default false,
          is_active boolean not null default true,
          public_visible boolean not null default true,
          confirmed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          primary key (profile_id, service_slug)
        );
        create table company_directory_service_areas (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid not null,
          service_slug text,
          radius_km numeric(6,2) not null,
          source_type text not null,
          confidence smallint not null,
          public_visible boolean not null default false,
          confirmed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create unique index company_directory_service_areas_service_unique_idx
          on company_directory_service_areas (profile_id, service_slug)
          where service_slug is not null;
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
      for (const mock of Object.values(mocks)) mock.mockReset();
      mocks.getUserWorkspaceAccess.mockResolvedValue({
        ok: true,
        userId: "user-1",
        workspaceId: WORKSPACE_ID,
        workspaceSlug: "owner-service",
        workspaceName: "Owner Service",
        workspaceStatus: "active",
        role: "owner",
      });
      mocks.canManageWorkspaceSettings.mockReturnValue(true);
      mocks.getDashboardWorkspaceServices.mockResolvedValue([]);
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_service_areas,
          company_directory_profile_services,
          company_directory_claims,
          workspace_services,
          company_directory_profiles,
          company_directory_services
      `);
      await client!.query(`
        insert into company_directory_services (slug, category_slug, label, is_active)
        values ($1, 'stadning', 'Fönsterputsning', true)
      `, [TARGET_SLUG]);
      await client!.query(`
        insert into company_directory_profiles (
          id, claimed_workspace_id, organization_number, organization_kind,
          legal_name, display_name, legal_form, organization_status, category_slug,
          address_line1, postal_code, city, public_slug,
          publication_status, is_active, privacy_blocked, auto_public_eligible,
          official_source, published_at, quality_reasons
        ) values (
          $1::uuid, $2::uuid, $3, 'sole_trader',
          'Owner Service', 'Owner Service', 'Enskild näringsverksamhet', 'Registrerad', 'stadning',
          '', '', 'Södertälje', 'owner-service-22222222',
          'blocked', true, true, false,
          'bolagsverket_vardefulla_datamangder:sole_trader_owner', null,
          '["sole_trader_owner_verification_pending"]'::jsonb
        )
      `, [PROFILE_ID, WORKSPACE_ID, `sole-trader-${PROFILE_ID}`]);
      await client!.query(`
        insert into company_directory_claims (
          id, profile_id, claimant_user_id, requested_workspace_id, status, verification_method
        ) values ($1::uuid, $2::uuid, 'user-1', $3::uuid, 'claimed', 'manual_review')
      `, [CLAIM_ID, PROFILE_ID, WORKSPACE_ID]);
      await client!.query(`
        insert into workspace_services (
          id, workspace_id, name, is_active, public_status, conversion_mode
        ) values ($1::uuid, $2::uuid, 'Fönsterputs', true, 'draft', 'quote')
      `, [SERVICE_ID, WORKSPACE_ID]);
    });

    it("keeps fixture columns aligned with canonical Marketplace migrations", async () => {
      const profileMigration = readFileSync(
        new URL("../db/migrations/20260809_0037_company_profile_engine_foundation.sql", import.meta.url),
        "utf8",
      );
      const serviceMigration = readFileSync(
        new URL("../db/migrations/20260813_0045_company_directory_service_location_foundation.sql", import.meta.url),
        "utf8",
      );
      const workspaceIdentityMigration = readFileSync(
        new URL("../db/migrations/20260823_0065_workspace_service_directory_identity.sql", import.meta.url),
        "utf8",
      );

      expect(profileMigration).toContain("legal_name text not null");
      expect(profileMigration).toContain("public_slug text not null");
      expect(profileMigration).toContain("claimant_user_id text not null");
      expect(serviceMigration).toContain("category_slug text not null");
      expect(serviceMigration).toContain("label text not null");
      expect(workspaceIdentityMigration).toContain("add column if not exists primary_directory_service_slug text");

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
            (table_name = 'company_directory_profiles' and column_name in ('legal_name', 'public_slug'))
            or (table_name = 'company_directory_claims' and column_name = 'claimant_user_id')
            or (table_name = 'company_directory_services' and column_name in ('category_slug', 'label'))
            or (table_name = 'workspace_services' and column_name = 'primary_directory_service_slug')
          )
      `);
      const columns = new Map(
        schema.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
      );

      expect(columns.get("company_directory_profiles.legal_name")).toMatchObject({ data_type: "text", is_nullable: "NO" });
      expect(columns.get("company_directory_profiles.public_slug")).toMatchObject({ data_type: "text", is_nullable: "NO" });
      expect(columns.get("company_directory_claims.claimant_user_id")).toMatchObject({ data_type: "text", is_nullable: "NO" });
      expect(columns.get("company_directory_services.category_slug")).toMatchObject({ data_type: "text", is_nullable: "NO" });
      expect(columns.get("company_directory_services.label")).toMatchObject({ data_type: "text", is_nullable: "NO" });
      expect(columns.get("workspace_services.primary_directory_service_slug")).toMatchObject({ data_type: "text", is_nullable: "YES" });
    }, 30_000);

    it("releases only business-safe profile fields while publishing the explicit owner service", async () => {
      await expect(activateProviderMarketplaceService({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 25,
      })).resolves.toEqual({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 25,
      });

      const profile = await client!.query<{
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
        published_at: string | null;
        organization_number: string;
        address_line1: string;
        postal_code: string;
        quality_reasons: string[];
      }>(`
        select publication_status, privacy_blocked, auto_public_eligible,
          published_at::text, organization_number, address_line1, postal_code,
          quality_reasons
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toEqual(expect.objectContaining({
        publication_status: "claimed",
        privacy_blocked: false,
        auto_public_eligible: true,
        organization_number: `sole-trader-${PROFILE_ID}`,
        address_line1: "",
        postal_code: "",
      }));
      expect(profile.rows[0]?.published_at).not.toBeNull();
      expect(profile.rows[0]?.quality_reasons).toContain("sole_trader_owner_verified_business_safe");
      expect(profile.rows[0]?.quality_reasons).not.toContain("sole_trader_owner_verification_pending");

      const service = await client!.query<{
        public_status: string;
        primary_directory_service_slug: string | null;
      }>(`
        select public_status, primary_directory_service_slug
        from workspace_services
        where id = $1::uuid
      `, [SERVICE_ID]);
      expect(service.rows[0]).toEqual({
        public_status: "published",
        primary_directory_service_slug: TARGET_SLUG,
      });

      const relation = await client!.query<{ source_type: string; public_visible: boolean }>(`
        select source_type, public_visible
        from company_directory_profile_services
        where profile_id = $1::uuid and service_slug = $2
      `, [PROFILE_ID, TARGET_SLUG]);
      expect(relation.rows).toEqual([{ source_type: "owner", public_visible: true }]);

      const area = await client!.query<{ source_type: string; radius_km: string; public_visible: boolean }>(`
        select source_type, radius_km::text, public_visible
        from company_directory_service_areas
        where profile_id = $1::uuid and service_slug = $2
      `, [PROFILE_ID, TARGET_SLUG]);
      expect(area.rows).toEqual([{ source_type: "owner", radius_km: "25.00", public_visible: true }]);
    }, 30_000);

    it("fails closed when a street address is present on the blocked sole-trader profile", async () => {
      await client!.query(`
        update company_directory_profiles
        set address_line1 = 'Private address 1'
        where id = $1::uuid
      `, [PROFILE_ID]);

      await expect(activateProviderMarketplaceService({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 25,
      })).rejects.toThrow("service_not_eligible");

      const profile = await client!.query<{
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
      }>(`
        select publication_status, privacy_blocked, auto_public_eligible
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toEqual({
        publication_status: "blocked",
        privacy_blocked: true,
        auto_public_eligible: false,
      });

      const service = await client!.query<{ public_status: string }>(`
        select public_status from workspace_services where id = $1::uuid
      `, [SERVICE_ID]);
      expect(service.rows[0]?.public_status).toBe("draft");
    }, 30_000);

    it("fails closed when the claimed manual-review claim belongs to another workspace", async () => {
      await client!.query(`
        update company_directory_claims
        set requested_workspace_id = $1::uuid
        where id = $2::uuid
      `, [OTHER_WORKSPACE_ID, CLAIM_ID]);

      await expect(activateProviderMarketplaceService({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 25,
      })).rejects.toThrow("service_not_eligible");

      const profile = await client!.query<{
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
      }>(`
        select publication_status, privacy_blocked, auto_public_eligible
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toEqual({
        publication_status: "blocked",
        privacy_blocked: true,
        auto_public_eligible: false,
      });

      const service = await client!.query<{ public_status: string }>(`
        select public_status from workspace_services where id = $1::uuid
      `, [SERVICE_ID]);
      expect(service.rows[0]?.public_status).toBe("draft");
    }, 30_000);

    it("fails closed when a claimed profile has no publication timestamp", async () => {
      await client!.query(`
        update company_directory_profiles
        set organization_number = '5560000000',
            organization_kind = 'juridical_person',
            legal_form = 'Aktiebolag',
            publication_status = 'claimed',
            privacy_blocked = false,
            auto_public_eligible = true,
            official_source = 'bolagsverket_vardefulla_datamangder:company',
            published_at = null,
            quality_reasons = '[]'::jsonb
        where id = $1::uuid
      `, [PROFILE_ID]);

      await expect(activateProviderMarketplaceService({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 25,
      })).rejects.toThrow("service_not_eligible");

      const profile = await client!.query<{
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
        published_at: string | null;
      }>(`
        select publication_status, privacy_blocked, auto_public_eligible, published_at::text
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toEqual({
        publication_status: "claimed",
        privacy_blocked: false,
        auto_public_eligible: true,
        published_at: null,
      });

      const serviceState = await client!.query<{ public_status: string; primary_directory_service_slug: string | null }>(`
        select public_status, primary_directory_service_slug
        from workspace_services
        where id = $1::uuid
      `, [SERVICE_ID]);
      expect(serviceState.rows[0]).toEqual({
        public_status: "draft",
        primary_directory_service_slug: null,
      });

      const relation = await client!.query(`
        select 1 from company_directory_profile_services where profile_id = $1::uuid
      `, [PROFILE_ID]);
      expect(relation.rows).toEqual([]);

      const area = await client!.query(`
        select 1 from company_directory_service_areas where profile_id = $1::uuid
      `, [PROFILE_ID]);
      expect(area.rows).toEqual([]);
    }, 30_000);

    it("prefers an already-claimed profile over a blocked sole trader for the same workspace", async () => {
      await client!.query(`
        insert into company_directory_profiles (
          id, claimed_workspace_id, organization_number, organization_kind,
          legal_name, display_name, legal_form, organization_status, category_slug,
          address_line1, postal_code, city, public_slug,
          publication_status, is_active, privacy_blocked, auto_public_eligible,
          official_source, published_at, quality_reasons, updated_at
        ) values (
          $1::uuid, $2::uuid, '5560000000', 'juridical_person',
          'Claimed Company AB', 'Claimed Company AB', 'Aktiebolag', 'Registrerad', 'stadning',
          '', '', 'Södertälje', 'claimed-company-ab',
          'claimed', true, false, true,
          'bolagsverket_vardefulla_datamangder:company', now(), '[]'::jsonb,
          now() - interval '1 day'
        )
      `, [CLAIMED_PROFILE_ID, WORKSPACE_ID]);

      await expect(activateProviderMarketplaceService({
        serviceId: SERVICE_ID,
        directoryServiceSlug: TARGET_SLUG,
        conversionMode: "quote",
        radiusKm: 20,
      })).resolves.toEqual(expect.objectContaining({ serviceId: SERVICE_ID, radiusKm: 20 }));

      const blocked = await client!.query<{
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
      }>(`
        select publication_status, privacy_blocked, auto_public_eligible
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(blocked.rows[0]).toEqual({
        publication_status: "blocked",
        privacy_blocked: true,
        auto_public_eligible: false,
      });

      const relation = await client!.query<{ profile_id: string }>(`
        select profile_id::text
        from company_directory_profile_services
        where service_slug = $1
      `, [TARGET_SLUG]);
      expect(relation.rows).toEqual([{ profile_id: CLAIMED_PROFILE_ID }]);
    }, 30_000);
  },
);
