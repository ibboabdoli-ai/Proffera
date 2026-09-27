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

import { getProviderActivationState } from "../src/lib/company-directory-provider-activation";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
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
  "Claimed profile service materialization PostgreSQL integration",
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
      containerName = `proffera-smart-claim-materialization-${process.pid}-${Date.now()}`;
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
      client = new Client({ connectionString });
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
        truncate table company_directory_profiles, workspace_services, workspaces
        restart identity cascade
      `);
      await client!.query(`
        insert into workspaces (id, slug, name, status)
        values ($1::uuid, 'owner-company', 'Owner Company', 'active')
      `, [WORKSPACE_ID]);
      await client!.query(`
        insert into company_directory_profiles (
          id, country_code, organization_number, organization_kind,
          legal_name, display_name, public_slug, claimed_workspace_id,
          legal_form, organization_status, city, category_slug,
          publication_status, is_active, privacy_blocked,
          auto_public_eligible, official_source, published_at, quality_score
        ) values (
          $1::uuid, 'SE', '5560000000', 'juridical_person',
          'Owner Company AB', 'Owner Company AB', 'owner-company-ab', $2::uuid,
          'Aktiebolag', 'Registrerad', 'Södertälje', 'stadning',
          'review', true, false,
          true, 'bolagsverket_vardefulla_datamangder:company', null, 98
        )
      `, [PROFILE_ID, WORKSPACE_ID]);
      await client!.query(
        `insert into company_directory_official_facts (
          profile_id, advertising_blocked, ongoing_procedures, source_payload_hash
        ) values ($1::uuid, false, '[]'::jsonb, 'facts-hash')`,
        [PROFILE_ID],
      );
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, workplaces, conflicts, source_payload_hash, provenance
        )
        select profile.id,
          profile.organization_number,
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
        update company_directory_profiles
        set publication_status = 'published'
        where id = $1::uuid
      `, [PROFILE_ID]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            published_at = null
        where id = $1::uuid
      `, [PROFILE_ID]);
      await client!.query(`
        insert into company_directory_profile_services (
          profile_id, service_slug, is_active, public_visible
        ) values ($1::uuid, $2, true, true)
      `, [PROFILE_ID, TARGET_SLUG]);
    });

    it("materializes a draft only after the claimed profile has a publication timestamp", async () => {
      await getProviderActivationState();

      const unpublished = await client!.query<{ count: string }>(`
        select count(*)::text as count
        from workspace_services
        where workspace_id = $1
      `, [WORKSPACE_ID]);
      expect(unpublished.rows[0]?.count).toBe("0");

      await client!.query(`
        update company_directory_profiles
        set published_at = now()
        where id = $1::uuid
      `, [PROFILE_ID]);
      await getProviderActivationState();
      await getProviderActivationState();

      const published = await client!.query<{
        name: string;
        public_status: string;
        primary_directory_service_slug: string | null;
      }>(`
        select name, public_status, primary_directory_service_slug
        from workspace_services
        where workspace_id = $1
        order by name asc
      `, [WORKSPACE_ID]);
      expect(published.rows).toEqual([{
        name: "Fönsterputsning",
        public_status: "draft",
        primary_directory_service_slug: TARGET_SLUG,
      }]);
    }, 30_000);
  },
);
