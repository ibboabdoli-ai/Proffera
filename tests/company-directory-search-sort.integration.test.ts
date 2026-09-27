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
  "public Directory search sort PostgreSQL integration",
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
      containerName = `proffera-public-search-sort-${process.pid}-${Date.now()}`;
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
      mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
      mocks.getSql.mockReturnValue(postgresSql(client!));

      await client!.query(`
        truncate table company_directory_profiles, workspace_services, workspaces
        restart identity cascade
      `); (slug, category_slug, label)
        values ('vvs', 'vvs', 'VVS / Rörmokare')
      `);

      const profiles = [
        ["11111111-1111-4111-8111-111111111111", "zulu-near", "Zulu Near AB", "5560000001", 90, 59.3000, 18.0000],
        ["22222222-2222-4222-8222-222222222222", "alpha-mid", "Alpha Mid AB", "5560000002", 95, 59.3200, 18.0000],
        ["33333333-3333-4333-8333-333333333333", "beta-far", "Beta Far AB", "5560000003", 99, 59.3500, 18.0000],
        ["44444444-4444-4444-8444-444444444444", "gamma-far", "Gamma Far AB", "5560000004", 99, 59.3500, 18.0000],
      ] as const;

      for (const [id, slug, name, organizationNumber, quality, latitude, longitude] of profiles) {
        await client!.query(`
          insert into company_directory_profiles (
            id, country_code, organization_number, organization_kind,
            legal_name, display_name, public_slug, category_slug, publication_status,
            address_line1, postal_code, city, municipality, quality_score,
            is_active, privacy_blocked, auto_public_eligible
          ) values (
            $1::uuid, 'SE', $4, 'juridical_person',
            $3, $3, $2, 'vvs', 'review',
            'Testgatan 1', '111 11', 'Stockholm', 'Stockholm', $5,
            true, false, true
          )
        `, [id, slug, name, organizationNumber, quality]);
        await client!.query(`
          insert into company_directory_profile_services (profile_id, service_slug)
          values ($1::uuid, 'vvs')
        `, [id]);
        await client!.query(`
          insert into company_directory_business_locations (profile_id, latitude, longitude, is_public)
          values ($1::uuid, $2, $3, true)
        `, [id, latitude, longitude]);
        await client!.query(`
          insert into company_directory_official_facts (profile_id, source_payload_hash)
          values ($1::uuid, 'facts-hash')
        `, [id]);
        await client!.query(`
          insert into company_directory_scb_enrichment (
            profile_id, organization_number, workplaces, conflicts, source_payload_hash, provenance
          )
          select
            profile.id,
            profile.organization_number,
            $2::jsonb,
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
        `, [id, JSON.stringify([{
          cfarNumber: id.slice(0, 8),
          municipality: "Stockholm",
          visitingAddress: {
            addressLine: "Testgatan 1",
            postalCode: "111 11",
            city: "Stockholm",
          },
        }])]);
        await client!.query(`
          update company_directory_profiles
          set publication_status = 'published',
              published_at = now()
          where id = $1::uuid
        `, [id]);
      }
    });

    it("orders actual returned results distinctly and deterministically", async () => {
      const common = {
        service: "vvs",
        latitude: 59.3000,
        longitude: 18.0000,
        radiusKm: 25,
        limit: 10,
      };

      const recommended = await searchPublishedCompanyDirectory({ ...common, sort: "recommended" });
      const nearest = await searchPublishedCompanyDirectory({ ...common, sort: "nearest" });
      const name = await searchPublishedCompanyDirectory({ ...common, sort: "name" });

      expect(recommended.results.map((result) => result.companyName)).toEqual([
        "Beta Far AB",
        "Gamma Far AB",
        "Alpha Mid AB",
        "Zulu Near AB",
      ]);
      expect(nearest.results.map((result) => result.companyName)).toEqual([
        "Zulu Near AB",
        "Alpha Mid AB",
        "Beta Far AB",
        "Gamma Far AB",
      ]);
      expect(name.results.map((result) => result.companyName)).toEqual([
        "Alpha Mid AB",
        "Beta Far AB",
        "Gamma Far AB",
        "Zulu Near AB",
      ]);
    }, 30_000);

    it("falls back to recommended ordering when nearest is unavailable or sort is invalid", async () => {
      const recommended = await searchPublishedCompanyDirectory({ service: "vvs", sort: "recommended", limit: 10 });
      const unavailableNearest = await searchPublishedCompanyDirectory({ service: "vvs", sort: "nearest", limit: 10 });
      const invalid = await searchPublishedCompanyDirectory({ service: "vvs", sort: "sponsored", limit: 10 });

      const expected = ["Beta Far AB", "Gamma Far AB", "Alpha Mid AB", "Zulu Near AB"];
      expect(recommended.results.map((result) => result.companyName)).toEqual(expected);
      expect(unavailableNearest.results.map((result) => result.companyName)).toEqual(expected);
      expect(invalid.results.map((result) => result.companyName)).toEqual(expected);
    }, 30_000);
  },
);
