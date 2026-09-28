import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

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
  "Directory service identity tenant isolation PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

    const profileId = "11111111-1111-4111-8111-111111111111";
    const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const workspaceServiceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const competingWorkspaceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const competingServiceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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
      containerName = `proffera-service-identity-tenant-${process.pid}-${Date.now()}`;
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
      mocks.getSql.mockReset();
      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_profiles, workspace_services, workspaces
        restart identity cascade
      `);

      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values
          ($1::uuid, 'active', 'marketplace-company', 'Marketplace Company'),
          ($2::uuid, 'active', 'competing-company', 'Competing Company')
      `, [workspaceId, competingWorkspaceId]);
      await client!.query(`
        insert into company_directory_profiles (
          id, country_code, organization_number, organization_kind,
          legal_name, display_name, public_slug, category_slug, publication_status,
          address_line1, postal_code, city, municipality, quality_score,
          is_active, privacy_blocked, auto_public_eligible
        ) values (
          $1::uuid, 'SE', '5560000000', 'juridical_person',
          'Canonical Workplace AB', 'Canonical Workplace AB', 'canonical-workplace-ab', 'vvs', 'review',
          'Gamla vägen 1', '111 11', 'Stockholm', 'Stockholm', 98,
          true, false, true
        )
      `, [profileId]);
      await client!.query(
        "insert into company_directory_official_facts (profile_id, source_payload_hash, advertising_blocked) values ($1::uuid, 'facts-hash', false)",
        [profileId],
      );
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, workplaces, conflicts, source_payload_hash, provenance
        )
        select
          profile.id,
          profile.organization_number,
          '[{"cfarNumber":"12345678","municipality":"Stockholm","visitingAddress":{"addressLine":"Ownergatan 1","postalCode":"111 11","city":"Stockholm"}}]'::jsonb,
          '[]'::jsonb,
          'scb-hash',
          jsonb_build_object(
            'comparisonSnapshot',
            jsonb_build_object(
              'profileUpdatedToken', profile.updated_at::text,
              'officialFactsLastSyncedToken', facts.last_synced_at::text
            )
          )
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.id = $1::uuid
      `, [profileId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'published',
            published_at = now()
        where id = $1::uuid
      `, [profileId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid
        where id = $2::uuid
      `, [workspaceId, profileId]);
      await client!.query(`
        insert into company_directory_profile_locations (
          id, profile_id, owner_workspace_id, purpose, visibility,
          is_visitable, is_primary, source_type,
          address_line1, postal_code, city, municipality, confirmed_at
        ) values (
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1::uuid, $2::uuid, 'workplace', 'public',
          true, true, 'owner',
          'Ownergatan 1', '111 11', 'Stockholm', 'Stockholm', now()
        )
      `, [profileId, workspaceId]);
      await client!.query(`
        insert into company_directory_profile_services (profile_id, service_slug)
        values ($1::uuid, 'vvs')
      `, [profileId]);
      await client!.query(`
        insert into workspace_services (
          id, workspace_id, name, public_slug, primary_directory_service_slug,
          conversion_mode, public_status
        ) values
          ($1::uuid, $2, 'Owner VVS', 'custom-vvs-sodertalje', 'vvs', 'quote', 'published'),
          ($3::uuid, $4, 'Competing VVS', 'vvs', null, 'quote', 'published')
      `, [workspaceServiceId, workspaceId, competingServiceId, competingWorkspaceId]);
      await client!.query(`
        insert into company_directory_service_areas (
          profile_id, service_slug, radius_km, public_visible, confirmed_at
        ) values ($1::uuid, 'vvs', 25, true, now())
      `, [profileId]);

      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
        [workspaceId, { planAccess: true, websiteBuilder: true, onlineBooking: false }],
      ]));
    });

    it("selects only the claimed workspace service when another tenant uses the same canonical service", async () => {
      const result = await searchPublishedCompanyDirectory({ service: "vvs", location: "Stockholm" });

      expect(result.totalCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        matchedServiceSlug: "vvs",
        claimedWorkspaceSlug: "marketplace-company",
        claimedServiceId: workspaceServiceId,
        claimedServiceSlug: "custom-vvs-sodertalje",
        conversionMode: "quote",
      });
      expect(result.results[0]?.claimedServiceId).not.toBe(competingServiceId);
      expect(result.results[0]?.claimedServiceSlug).not.toBe("wrong-tenant-vvs");
    }, 30_000);
  },
);