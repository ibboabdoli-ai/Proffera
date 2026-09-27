import { execFileSync } from "node:child_process";
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
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SERVICE_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_SLUG = "fonsterputsning";
const ACTIVATION_APP = "proffera-provider-activation-area-race";

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
  "Marketplace activation owner-area concurrency PostgreSQL integration",
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

    async function waitForActivationToBlock(blocker: Client) {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const state = await blocker.query<{ wait_event_type: string | null }>(`
          select wait_event_type
          from pg_stat_activity
          where application_name = $1
            and pid <> pg_backend_pid()
        `, [ACTIVATION_APP]);
        if (state.rows.some((row) => row.wait_event_type === "Lock")) return;
        await delay(25);
      }
      throw new Error("Activation did not block on the concurrent database lock");
    }

    beforeAll(async () => {
      containerName = `proffera-provider-area-race-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgis/postgis:16-3.5-alpine",
      ]);

      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString, application_name: ACTIVATION_APP });
      await client.connect();

      await applyCanonicalProfferaMigrations(client);
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
        workspaceSlug: "owner-company",
        workspaceName: "Owner Company",
        workspaceStatus: "active",
        role: "owner",
      });
      mocks.canManageWorkspaceSettings.mockReturnValue(true);
      mocks.getDashboardWorkspaceServices.mockResolvedValue([]);
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_service_areas,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_profile_locations,
          company_directory_profile_services,
          company_directory_claims,
          workspace_services,
          company_directory_profiles,
          workspaces
        restart identity cascade
      `);
      await client!.query(`
        insert into workspaces (id, slug, name, company_name, primary_city, status)
        values ($1::uuid, 'owner-company', 'Owner Company', 'Owner Company AB', 'Södertälje', 'active')
      `, [WORKSPACE_ID]);
      await client!.query(`
        insert into company_directory_profiles (
          id, claimed_workspace_id, organization_number, organization_kind,
          legal_name, display_name, legal_form, organization_status,
          public_slug, category_slug, city, municipality,
          publication_status, is_active, privacy_blocked, auto_public_eligible,
          official_source, published_at, quality_score, quality_reasons
        ) values (
          $1::uuid, $2::uuid, '5560000000', 'juridical_person',
          'Owner Company AB', 'Owner Company AB', 'Aktiebolag', 'Registrerad',
          'owner-company-ab', 'stadning', 'Södertälje', 'Södertälje',
          'claimed', true, false, true,
          'bolagsverket_vardefulla_datamangder:company', now(), 95, '[]'::jsonb
        )
      `, [PROFILE_ID, WORKSPACE_ID]);
      await client!.query(`
        insert into company_directory_official_facts (
          profile_id, advertising_blocked, ongoing_procedures, source_payload_hash
        ) values ($1::uuid, false, '[]'::jsonb, 'facts-hash')
      `, [PROFILE_ID]);
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, observed_company_name,
          workplaces, conflicts, source_payload_hash, provenance
        )
        select profile.id, profile.organization_number, profile.display_name,
          '[{"cfarNumber":"12345678","municipality":"Södertälje","visitingAddress":{"addressLine":"Industrivägen 2","postalCode":"151 00","city":"Södertälje"}}]'::jsonb,
          '[]'::jsonb,
          'scb-hash',
          jsonb_build_object('comparisonSnapshot', jsonb_build_object(
            'profileUpdatedToken', profile.updated_at::text,
            'officialFactsLastSyncedToken', facts.last_synced_at::text
          ))
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.id = $1::uuid
      `, [PROFILE_ID]);
      await client!.query(`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary,
          is_active, public_visible, confirmed_at
        ) values ($1::uuid, $2, 'owner', 100, true, true, true, now())
      `, [PROFILE_ID, TARGET_SLUG]);
      await client!.query(`
        insert into workspace_services (
          id, workspace_id, name, is_active, public_status, conversion_mode
        ) values ($1::uuid, $2, 'Fönsterputs', true, 'draft', 'quote')
      `, [SERVICE_ID, WORKSPACE_ID]);
    });

    it("does not publish or create an owner relation when a concurrent admin area wins the unique key", async () => {
      const blocker = new Client({ connectionString, application_name: "proffera-provider-area-race-blocker" });
      await blocker.connect();
      try {
        await blocker.query("begin");
        await blocker.query(`
          insert into company_directory_service_areas (
            profile_id, service_slug, radius_km, source_type, confidence, public_visible, confirmed_at
          ) values ($1::uuid, $2, 40, 'admin', 100, true, now())
        `, [PROFILE_ID, TARGET_SLUG]);

        const activationOutcome = activateProviderMarketplaceService({
          serviceId: SERVICE_ID,
          directoryServiceSlug: TARGET_SLUG,
          conversionMode: "quote",
          radiusKm: 20,
        }).then(
          () => ({ ok: true as const, error: null }),
          (error: unknown) => ({ ok: false as const, error }),
        );

        await waitForActivationToBlock(blocker);
        await blocker.query("commit");

        const outcome = await activationOutcome;
        expect(outcome.ok).toBe(false);
        expect(outcome.error).toBeInstanceOf(Error);
        expect((outcome.error as Error).message).toBe("service_update");

        const service = await client!.query<{
          public_status: string;
          primary_directory_service_slug: string | null;
        }>(`
          select public_status, primary_directory_service_slug
          from workspace_services
          where id = $1::uuid
        `, [SERVICE_ID]);
        expect(service.rows[0]).toEqual({
          public_status: "draft",
          primary_directory_service_slug: null,
        });

        const relations = await client!.query<{ count: string }>(`
          select count(*)::text as count
          from company_directory_profile_services
          where profile_id = $1::uuid and service_slug = $2
        `, [PROFILE_ID, TARGET_SLUG]);
        expect(relations.rows[0]?.count).toBe("0");

        const area = await client!.query<{ source_type: string; radius_km: string }>(`
          select source_type, radius_km::text
          from company_directory_service_areas
          where profile_id = $1::uuid and service_slug = $2
        `, [PROFILE_ID, TARGET_SLUG]);
        expect(area.rows).toEqual([{ source_type: "admin", radius_km: "40.00" }]);
      } finally {
        await blocker.query("rollback").catch(() => undefined);
        await blocker.end().catch(() => undefined);
      }
    }, 30_000);

    it("fails closed when the workspace service identity changes while activation waits on the row lock", async () => {
      const blocker = new Client({ connectionString, application_name: "proffera-provider-service-identity-race-blocker" });
      await blocker.connect();
      try {
        await blocker.query("begin");
        await blocker.query(`
          update workspace_services
          set name = 'Flyttstädning', updated_at = now()
          where id = $1::uuid
        `, [SERVICE_ID]);

        const activationOutcome = activateProviderMarketplaceService({
          serviceId: SERVICE_ID,
          directoryServiceSlug: TARGET_SLUG,
          conversionMode: "quote",
          radiusKm: 20,
        }).then(
          () => ({ ok: true as const, error: null }),
          (error: unknown) => ({ ok: false as const, error }),
        );

        await waitForActivationToBlock(blocker);
        await blocker.query("commit");

        const outcome = await activationOutcome;
        expect(outcome.ok).toBe(false);
        expect(outcome.error).toBeInstanceOf(Error);
        expect((outcome.error as Error).message).toBe("service_update");

        const service = await client!.query<{
          name: string;
          public_status: string;
          primary_directory_service_slug: string | null;
        }>(`
          select name, public_status, primary_directory_service_slug
          from workspace_services
          where id = $1::uuid
        `, [SERVICE_ID]);
        expect(service.rows[0]).toEqual({
          name: "Flyttstädning",
          public_status: "draft",
          primary_directory_service_slug: null,
        });

        const relations = await client!.query<{ count: string }>(`
          select count(*)::text as count
          from company_directory_profile_services
          where profile_id = $1::uuid and service_slug = $2
        `, [PROFILE_ID, TARGET_SLUG]);
        expect(relations.rows[0]?.count).toBe("0");

        const areas = await client!.query<{ count: string }>(`
          select count(*)::text as count
          from company_directory_service_areas
          where profile_id = $1::uuid and service_slug = $2
        `, [PROFILE_ID, TARGET_SLUG]);
        expect(areas.rows[0]?.count).toBe("0");
      } finally {
        await blocker.query("rollback").catch(() => undefined);
        await blocker.end().catch(() => undefined);
      }
    }, 30_000);
  },
);
