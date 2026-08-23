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
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_service_areas, workspace_services,
          company_directory_scb_enrichment, company_directory_business_locations,
          company_directory_profile_services, company_directory_services,
          company_directory_profiles, workspaces
      `);

      await client!.query(`
        insert into workspaces (id, status, slug)
        values
          ($1, 'active', 'marketplace-company'),
          ($2, 'active', 'competing-company')
      `, [workspaceId, competingWorkspaceId]);
      await client!.query(`
        insert into company_directory_profiles (
          id, public_slug, display_name, category_slug, publication_status,
          address_line1, postal_code, city, municipality, quality_score,
          claimed_workspace_id, published_at
        ) values (
          $1, 'canonical-workplace-ab', 'Canonical Workplace AB', 'vvs', 'claimed',
          'Gamla vägen 1', '111 11', 'Stockholm', 'Stockholm', 98,
          $2, now()
        )
      `, [profileId, workspaceId]);
      await client!.query(`
        insert into company_directory_services (slug, category_slug, label)
        values ('vvs', 'vvs', 'VVS / Rörmokare')
      `);
      await client!.query(`
        insert into company_directory_profile_services (profile_id, service_slug)
        values ($1, 'vvs')
      `, [profileId]);
      await client!.query(`
        insert into workspace_services (
          id, workspace_id, public_slug, primary_directory_service_slug, conversion_mode
        ) values
          ($1, $2, 'custom-vvs-sodertalje', 'vvs', 'quote'),
          ($3, $4, 'vvs', null, 'quote')
      `, [workspaceServiceId, workspaceId, competingServiceId, competingWorkspaceId]);
      await client!.query(`
        insert into company_directory_service_areas (
          profile_id, service_slug, radius_km, public_visible, confirmed_at
        ) values ($1, 'vvs', 25, true, now())
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
