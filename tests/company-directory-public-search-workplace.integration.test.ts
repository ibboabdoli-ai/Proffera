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

import {
  getPublishedDirectoryLocationSuggestions,
  searchPublishedCompanyDirectory,
} from "@/lib/company-directory-public-search";

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
  "public Directory canonical workplace search PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;
    const profileId = "11111111-1111-4111-8111-111111111111";
    const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const workspaceServiceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
      expect(unfiltered.totalCount).toBe(1);
      expect(unfiltered.results).toHaveLength(1);
      expect(unfiltered.results[0]).toMatchObject({
        slug: "canonical-workplace-ab",
        postalCode: "",
        city: "",
        municipality: "",
      });

      const stockholm = await searchPublishedCompanyDirectory({ location: "Stockholm" });
      expect(stockholm.totalCount).toBe(0);
      expect(stockholm.results).toEqual([]);

      const sodertalje = await searchPublishedCompanyDirectory({ location: "Södertälje" });
      expect(sodertalje.totalCount).toBe(0);
      expect(sodertalje.results).toEqual([]);

      const suggestions = await getPublishedDirectoryLocationSuggestions();
      expect(suggestions).not.toContain("Stockholm");
      expect(suggestions).not.toContain("Södertälje");
    }

    async function expectClaimedProfileLocation() {
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
    }

    beforeAll(async () => {
      containerName = `proffera-public-search-workplace-${process.pid}-${Date.now()}`;
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

      // This fixture intentionally contains only the columns read by
      // searchPublishedCompanyDirectory. Migration-backed SCB projection behavior is
      // covered separately in company-directory-scb-enrichment.test.ts.
      await client.query(`
        create table workspaces (
          id uuid primary key,
          status text not null,
          slug text not null,
          public_booking_slug text
        );
        create table company_directory_profiles (
          id uuid primary key,
          public_slug text not null,
          display_name text not null,
          category_slug text not null,
          publication_status text not null,
          activity_description text not null default '',
          address_line1 text not null default '',
          postal_code text not null default '',
          city text not null default '',
          municipality text not null default '',
          quality_score integer not null default 95,
          claimed_workspace_id uuid,
          published_at timestamptz,
          auto_public_eligible boolean not null default true,
          is_active boolean not null default true,
          privacy_blocked boolean not null default false
        );
        create table company_directory_services (
          slug text primary key,
          category_slug text not null,
          label text not null,
          is_active boolean not null default true
        );
        create table company_directory_profile_services (
          profile_id uuid not null,
          service_slug text not null,
          is_active boolean not null default true,
          public_visible boolean not null default true
        );
        create table company_directory_business_locations (
          profile_id uuid primary key,
          latitude numeric,
          longitude numeric,
          is_public boolean not null default true
        );
        create table company_directory_scb_enrichment (
          profile_id uuid primary key,
          workplaces jsonb not null default '[]'::jsonb,
          conflicts jsonb not null default '[]'::jsonb
        );
        create table workspace_services (
          id uuid primary key,
          workspace_id text not null,
          public_slug text not null,
          primary_directory_service_slug text,
          conversion_mode text,
          is_active boolean not null default true,
          public_status text not null default 'published'
        );
        create table company_directory_service_areas (
          profile_id uuid not null,
          service_slug text,
          radius_km numeric,
          public_visible boolean not null default false,
          confirmed_at timestamptz
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
      mocks.getSql.mockReset();
      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();
      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_service_areas, workspace_services,
          company_directory_scb_enrichment, company_directory_business_locations,
          company_directory_profile_services, company_directory_services,
          company_directory_profiles, workspaces
      `);

      await client!.query(`
        insert into company_directory_profiles (
          id, public_slug, display_name, category_slug, publication_status,
          address_line1, postal_code, city, municipality, quality_score
        ) values (
          $1, 'canonical-workplace-ab', 'Canonical Workplace AB', 'vvs', 'published',
          'Gamla vägen 1', '111 11', 'Stockholm', 'Stockholm', 98
        )
      `, [profileId]);
      await client!.query(`
        insert into company_directory_services (slug, category_slug, label)
        values ('vvs', 'vvs', 'VVS / Rörmokare')
      `);
      await client!.query(`
        insert into company_directory_profile_services (profile_id, service_slug)
        values ($1, 'vvs')
      `, [profileId]);
      await client!.query(`
        insert into company_directory_scb_enrichment (profile_id, workplaces, conflicts)
        values (
          $1,
          '[{"cfarNumber":"12345678","municipality":"Södertälje","visitingAddress":{"addressLine":"NYA VÄGEN 2","postalCode":"151 00","city":"SÖDERTÄLJE"}}]'::jsonb,
          '[]'::jsonb
        )
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
        insert into workspaces (id, status, slug)
        values ($1, 'active', 'marketplace-company')
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
          id, workspace_id, public_slug, primary_directory_service_slug, conversion_mode
        ) values ($1, $2, 'custom-vvs-sodertalje', 'vvs', 'quote')
      `, [workspaceServiceId, workspaceId]);
      await client!.query(`
        insert into company_directory_service_areas (
          profile_id, service_slug, radius_km, public_visible, confirmed_at
        ) values ($1, 'vvs', 25, true, now())
      `, [profileId]);

      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
        [workspaceId, { planAccess: true, websiteBuilder: true, onlineBooking: false }],
      ]));

      const result = await searchPublishedCompanyDirectory({ service: "vvs", location: "Stockholm" });

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

    it("keeps claimed Workspace-owned profile location authoritative", async () => {
      await client!.query(`
        insert into workspaces (id, status, slug)
        values ($1, 'active', 'claimed-company')
      `, [workspaceId]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'claimed',
            claimed_workspace_id = $1::uuid,
            published_at = now()
        where id = $2
      `, [workspaceId, profileId]);

      await expectClaimedProfileLocation();
    }, 30_000);
  },
);
