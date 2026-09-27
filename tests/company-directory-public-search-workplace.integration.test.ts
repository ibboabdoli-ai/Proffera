import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  readPublicDirectoryMissCache: async (_slug: string, loader: () => Promise<{ value: unknown }>) =>
    (await loader()).value,
  readPublicDirectoryProfileCache: async (_slug: string, loader: () => Promise<{ value: unknown }>) =>
    (await loader()).value,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import {
  getPublishedDirectoryLocationSuggestions,
  searchPublishedCompanyDirectory,
} from "@/lib/company-directory-public-search";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(
  client: Client,
  before?: (query: string) => void | Promise<void>,
) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    await before?.(query.replace(/\s+/gu, " ").trim().toLowerCase());
    const result = await client.query(query, values);
    return result.rows;
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "public Directory canonical workplace search PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;
    const profileId = "11111111-1111-4111-8111-111111111111";
    const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const workspaceServiceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    async function prepareClaimedDisclosure() {
      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values ($1::uuid, 'active', 'claimed-disclosure', 'Claimed Disclosure')
      `, [workspaceId]);
      await client!.query(`
        insert into workspace_plans (
          id, workspace_id, plan_key, status, current_period_start, current_period_end
        ) values (
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', $1::uuid,
          'starter', 'active', now() - interval '1 day', now() + interval '30 days'
        )
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid,
            published_at = now()
        where id = $2::uuid
      `, [workspaceId, profileId]);
      await client!.query(`
        insert into company_directory_profile_locations (
          id, profile_id, owner_workspace_id, purpose, visibility,
          is_visitable, is_primary, source_type,
          address_line1, postal_code, city, municipality, confirmed_at
        ) values (
          'ffffffff-ffff-4fff-8fff-ffffffffffff', $1::uuid, $2::uuid,
          'workplace', 'public', true, true, 'owner',
          'OWNERGATAN 1', '111 22', 'Stockholm', 'Stockholm', now()
        )
      `, [profileId, workspaceId]);
      mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    }

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

    async function expectUnclaimedPhysicalLocationUnavailable() {
      const unfiltered = await searchPublishedCompanyDirectory();
      expect(unfiltered.totalCount).toBe(0);
      expect(unfiltered.results).toEqual([]);

      const stockholm = await searchPublishedCompanyDirectory({ location: "Stockholm" });
      expect(stockholm.totalCount).toBe(0);
      expect(stockholm.results).toEqual([]);

      const sodertalje = await searchPublishedCompanyDirectory({ location: "Södertälje" });
      expect(sodertalje.totalCount).toBe(0);
      expect(sodertalje.results).toEqual([]);

      const suggestions = await getPublishedDirectoryLocationSuggestions();
      expect(suggestions).not.toContain("Stockholm");
      expect(suggestions).not.toContain("Södertälje");

      // A stale/legacy coordinate must not resurrect an unavailable unclaimed
      // physical location in nearby search.
      await client!.query(`
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, is_public
        ) values ($1, 59.3293, 18.0686, true)
        on conflict (profile_id) do update set
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          is_public = true
      `, [profileId]);
      const nearby = await searchPublishedCompanyDirectory({
        latitude: 59.3293,
        longitude: 18.0686,
        radiusKm: 5,
      });
      expect(nearby.totalCount).toBe(0);
      expect(nearby.results).toEqual([]);
    }

    async function expectClaimedOwnerLocation() {
      const stockholm = await searchPublishedCompanyDirectory({ location: "Stockholm" });
      expect(stockholm.totalCount).toBe(1);
      expect(stockholm.results).toHaveLength(1);
      expect(stockholm.results[0]).toMatchObject({
        slug: "canonical-workplace-ab",
        postalCode: "111 11",
        city: "Stockholm",
        municipality: "Stockholm",
      });

      const sodertalje = await searchPublishedCompanyDirectory({ location: "Södertälje" });
      expect(sodertalje.totalCount).toBe(0);
      expect(sodertalje.results).toEqual([]);

      const suggestions = await getPublishedDirectoryLocationSuggestions();
      expect(suggestions).toContain("Stockholm");
      expect(suggestions).not.toContain("Södertälje");
    }

    beforeAll(async () => {
      containerName = `proffera-public-search-workplace-${process.pid}-${Date.now()}`;
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
      mocks.getPublicDirectoryBusiness.mockReset();
      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
      mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_profiles, workspace_services, workspaces
        restart identity cascade
      `);

      await client!.query(`
        insert into company_directory_profiles (
          id, country_code, organization_number, organization_kind,
          legal_name, display_name, public_slug, category_slug, publication_status,
          address_line1, postal_code, city, municipality, quality_score,
          is_active, privacy_blocked, auto_public_eligible, official_source
        ) values (
          $1::uuid, 'SE', '5560000000', 'juridical_person',
          'Canonical Workplace AB', 'Canonical Workplace AB', 'canonical-workplace-ab', 'vvs', 'review',
          'Gamla vägen 1', '111 11', 'Stockholm', 'Stockholm', 98,
          true, false, true, 'bolagsverket_vardefulla_datamangder:company'
        )
      `, [profileId]);
      await client!.query(`
        insert into company_directory_profile_services (profile_id, service_slug)
        values ($1::uuid, 'vvs')
      `, [profileId]);
      await client!.query(
        "insert into company_directory_official_facts (profile_id, source_payload_hash) values ($1::uuid, 'facts-hash')",
        [profileId],
      );
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, workplaces, conflicts, source_payload_hash, provenance
        )
        select
          profile.id,
          profile.organization_number,
          '[{"cfarNumber":"12345678","municipality":"Södertälje","visitingAddress":{"addressLine":"NYA VÄGEN 2","postalCode":"151 00","city":"SÖDERTÄLJE"}}]'::jsonb,
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
    });

    it("returns the canonical SCB workplace city and excludes the stale profile city", async () => {
      const sodertalje = await searchPublishedCompanyDirectory({ location: "Södertälje" });
      expect(sodertalje.totalCount).toBe(1);
      expect(sodertalje.results).toHaveLength(1);
      expect(sodertalje.results[0]).toMatchObject({
        slug: "canonical-workplace-ab",
        postalCode: "151 00",
        city: "SÖDERTÄLJE",
        municipality: "Södertälje",
      });

      const stockholm = await searchPublishedCompanyDirectory({ location: "Stockholm" });
      expect(stockholm.totalCount).toBe(0);
      expect(stockholm.results).toEqual([]);
    }, 30_000);

    it("fails closed instead of using the profile location when SCB evidence has conflicts", async () => {
      await client!.query(`
        update company_directory_scb_enrichment
        set conflicts = '[{"field":"legal_name","code":"legal_name_mismatch"}]'::jsonb
        where profile_id = $1
      `, [profileId]);

      await expectUnclaimedPhysicalLocationUnavailable();
    }, 30_000);

    it("fails closed instead of using the profile location for multiple SCB workplaces", async () => {
      await client!.query(`
        update company_directory_scb_enrichment
        set workplaces = workplaces || workplaces
        where profile_id = $1
      `, [profileId]);

      await expectUnclaimedPhysicalLocationUnavailable();
    }, 30_000);

    it("fails closed instead of using the profile location when workplace municipality is missing", async () => {
      await client!.query(`
        update company_directory_scb_enrichment
        set workplaces = jsonb_set(workplaces, '{0,municipality}', '""'::jsonb)
        where profile_id = $1
      `, [profileId]);

      await expectUnclaimedPhysicalLocationUnavailable();
    }, 30_000);

    it("matches claimed Marketplace services by canonical identity while preserving the public URL slug", async () => {
      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values ($1, 'active', 'marketplace-company', 'Marketplace Company')
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1,
            published_at = now()
        where id = $2
      `, [workspaceId, profileId]);
      await client!.query(`
        insert into workspace_services (
          id, workspace_id, name, public_slug, primary_directory_service_slug,
          conversion_mode, public_status
        ) values (
          $1, $2::text, 'VVS / Rörmokare', 'custom-vvs-sodertalje', 'vvs',
          'quote', 'published'
        )
      `, [workspaceServiceId, workspaceId]);
      await client!.query(`
        insert into company_directory_service_areas (
          profile_id, service_slug, radius_km, public_visible, confirmed_at
        ) values ($1, 'vvs', 25, true, now())
      `, [profileId]);

      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
        [workspaceId, { planAccess: true, websiteBuilder: true, onlineBooking: false }],
      ]));

      const result = await searchPublishedCompanyDirectory({ service: "vvs", location: "Södertälje" });

      expect(result.totalCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        matchedServiceSlug: "vvs",
        claimedWorkspaceSlug: "marketplace-company",
        claimedServiceId: workspaceServiceId,
        claimedServiceSlug: "custom-vvs-sodertalje",
        conversionMode: "quote",
        bookingAvailable: false,
      });

      const storedService = await client!.query(
        "select public_slug, primary_directory_service_slug from workspace_services where id = $1",
        [workspaceServiceId],
      );
      expect(storedService.rows[0]).toMatchObject({
        public_slug: "custom-vvs-sodertalje",
        primary_directory_service_slug: "vvs",
      });
    }, 30_000);

    it("does not treat a claim alone as authority for the stored profile postal location", async () => {
      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values ($1, 'active', 'claimed-company', 'Claimed Company')
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid,
            published_at = now()
        where id = $2
      `, [workspaceId, profileId]);

      const stockholm = await searchPublishedCompanyDirectory({ location: "Stockholm" });
      expect(stockholm.totalCount).toBe(0);
      const sodertalje = await searchPublishedCompanyDirectory({ location: "Södertälje" });
      expect(sodertalje.totalCount).toBe(1);
      expect(sodertalje.results[0]).toMatchObject({
        postalCode: "151 00",
        city: "SÖDERTÄLJE",
        municipality: "Södertälje",
      });
      const suggestions = await getPublishedDirectoryLocationSuggestions();
      expect(suggestions).toContain("Södertälje");
      expect(suggestions).not.toContain("Stockholm");
    }, 30_000);

    it("keeps the claimed Workspace primary owner location authoritative", async () => {
      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values ($1, 'active', 'claimed-company', 'Claimed Company')
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid,
            published_at = now()
        where id = $2
      `, [workspaceId, profileId]);
      await client!.query(`
        insert into company_directory_profile_locations (
          id, profile_id, owner_workspace_id, purpose, visibility,
          is_visitable, is_primary, source_type,
          address_line1, postal_code, city, municipality,
          latitude, longitude, confirmed_at
        ) values (
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, $2, 'workplace', 'public',
          true, true, 'owner',
          'OWNERGATAN 1', '111 11', 'Stockholm', 'Stockholm',
          59.3293, 18.0686, now()
        )
      `, [profileId, workspaceId]);

      await expectClaimedOwnerLocation();

      await client!.query(`
        insert into company_directory_business_locations (profile_id, latitude, longitude, is_public)
        values ($1, 55.6050, 13.0038, true)
      `, [profileId]);
      const nearby = await searchPublishedCompanyDirectory({
        latitude: 59.3293,
        longitude: 18.0686,
        radiusKm: 5,
      });
      expect(nearby.totalCount).toBe(1);
      expect(nearby.results[0]?.distanceKm).not.toBeNull();
    }, 30_000);

    it("loads claimed disclosure through one canonical PostgreSQL projection", async () => {
      await prepareClaimedDisclosure();
      let claimedReads = 0;
      mocks.getSql.mockReturnValue(postgresSql(client!, async (query) => {
        if (query.includes("from company_directory_profiles profile")) claimedReads += 1;
      }));

      const result = await getPublicDirectoryBusinessForRequest("canonical-workplace-ab");

      expect(claimedReads).toBe(1);
      expect(result).toMatchObject({
        publicationStatus: "claimed",
        addressLine1: "OWNERGATAN 1",
        postalCode: "111 22",
        city: "Stockholm",
        municipality: "Stockholm",
        contact: {
          entitled: true,
          addressLine1: "OWNERGATAN 1",
        },
      });
    }, 30_000);

    it("does not admit an inactive claimed Workspace into location suggestions", async () => {
      await client!.query(`
        insert into workspaces (id, status, slug, name)
        values ($1, 'paused', 'inactive-company', 'Inactive Company')
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid,
            published_at = now()
        where id = $2
      `, [workspaceId, profileId]);
      await client!.query(`
        insert into company_directory_profile_locations (
          id, profile_id, owner_workspace_id, purpose, visibility,
          is_visitable, is_primary, source_type,
          address_line1, postal_code, city, municipality, confirmed_at
        ) values (
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd', $1, $2, 'workplace', 'public',
          true, true, 'owner',
          'OWNERGATAN 1', '111 11', 'Stockholm', 'Stockholm', now()
        )
      `, [profileId, workspaceId]);

      const suggestions = await getPublishedDirectoryLocationSuggestions();
      expect(suggestions).not.toContain("Stockholm");
      expect(suggestions).not.toContain("Södertälje");
    }, 30_000);
  },
);
