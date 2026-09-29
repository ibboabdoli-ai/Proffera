import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdmin: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  geocodeDirectoryProviderPointsFromAdmin,
  getDirectoryGeocodingStatus,
} from "../src/lib/company-directory-geocoding";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    return (await client.query(query, values)).rows;
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Directory provider stale-point PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

    beforeAll(async () => {
      containerName = `proffera-provider-stale-point-${process.pid}-${Date.now()}`;
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
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          await probe.query("select 1");
          await probe.end();
          break;
        } catch (error) {
          await probe.end().catch(() => undefined);
          if (attempt === 79) throw error;
          await delay(500);
        }
      }

      client = new Client({ connectionString });
      await client.connect();
      await client.query("create extension if not exists postgis");
      await applyCanonicalProfferaMigrations(client);
    }, 120_000);

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm may already have removed a failed container.
        }
      }
    }, 30_000);

    beforeEach(async () => {
      vi.restoreAllMocks();
      mocks.getPlatformAdmin.mockReset();
      mocks.getSql.mockReset();
      mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
      mocks.getSql.mockReturnValue(postgresSql(client!));

      process.env.COMPANY_DIRECTORY_GEOCODING_ENABLED = "true";
      process.env.LANTMATERIET_ADDRESS_API_USERNAME = "test-user";
      process.env.LANTMATERIET_ADDRESS_API_PASSWORD = "test-password";

      await client!.query(`
        truncate table company_directory_business_locations,
          company_directory_profile_services,
          company_directory_scb_enrichment,
          company_directory_profiles
        restart identity cascade
      `);

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, city, municipality, category_slug, quality_score,
          publication_status, is_active, privacy_blocked, auto_public_eligible
        ) values (
          $1::uuid, '5560000000', 'juridical_person', 'Stale Point AB', 'Stale Point AB',
          'stale-point-ab', 'Södertälje', 'Södertälje', 'vvs', 95,
          'review', true, false, true
        )
      `, [PROFILE_ID]);

      await client!.query(`
        insert into company_directory_service_categories (slug, label)
        values ('hem', 'Hem')
        on conflict (slug) do nothing
      `);
      await client!.query(`
        insert into company_directory_services (slug, category_slug, label)
        values ('vvs', 'hem', 'VVS')
        on conflict (slug) do nothing
      `);
      await client!.query(`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible
        ) values ($1::uuid, 'vvs', 'sni', 100, true, true, true)
      `, [PROFILE_ID]);

      await client!.query(`
        insert into company_directory_official_facts (
          profile_id, source_payload_hash, advertising_blocked
        ) values ($1::uuid, 'facts-hash', false)
      `, [PROFILE_ID]);
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, workplaces, conflicts, source_payload_hash,
          provenance, last_synced_at
        )
        select
          profile.id, profile.organization_number,
          '[{"cfarNumber":"12345678","municipality":"Södertälje","visitingAddress":{"addressLine":"Storgatan 1","postalCode":"151 00","city":"Södertälje"}}]'::jsonb,
          '[]'::jsonb, 'scb-hash',
          jsonb_build_object(
            'workplaceChangedAt', (now() - interval '1 hour')::text,
            'comparisonSnapshot', jsonb_build_object(
              'profileUpdatedToken', profile.updated_at::text,
              'officialFactsLastSyncedToken', facts.last_synced_at::text
            )
          ),
          now()
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.id = $1::uuid
      `, [PROFILE_ID]);
      await client!.query(`
        update company_directory_profiles
        set publication_status = 'published', published_at = now()
        where id = $1::uuid
      `, [PROFILE_ID]);

      await client!.query(`
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, geocode_source, geocode_precision,
          geocode_confidence, is_public, geocoded_at
        ) values (
          $1::uuid, 59.1955, 17.6253, 'lantmateriet_belagenhetsadress_v4_2',
          'address', 100, true, now() - interval '2 hours'
        )
      `, [PROFILE_ID]);
    });

    it("skips a coordinate row geocoded after the canonical workplace change", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected upstream call"));
      await client!.query(
        "update company_directory_business_locations set geocoded_at = now() + interval '1 minute' where profile_id = $1::uuid",
        [PROFILE_ID],
      );

      const result = await geocodeDirectoryProviderPointsFromAdmin(1);

      expect(result.attempted).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("clears stale coordinates when the replacement workplace has no address match", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const result = await geocodeDirectoryProviderPointsFromAdmin(1);

      expect(result.attempted).toBe(1);
      expect(result.noMatch).toBe(1);
      expect(fetchSpy).toHaveBeenCalled();

      const location = await client!.query<{
        latitude: number | null;
        longitude: number | null;
        geocode_source: string;
      }>(
        "select latitude, longitude, geocode_source from company_directory_business_locations where profile_id = $1::uuid",
        [PROFILE_ID],
      );
      expect(location.rows[0]?.latitude).toBeNull();
      expect(location.rows[0]?.longitude).toBeNull();
      expect(location.rows[0]?.geocode_source).toContain("lantmateriet_no_match_v4_2");

      const status = await getDirectoryGeocodingStatus();
      expect(status.geocoded).toBe(0);
    });

    it("selects and marks a coordinate row stale only when the canonical workplace changed", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("temporary upstream failure"));

      const result = await geocodeDirectoryProviderPointsFromAdmin(1);

      expect(result.attempted).toBe(1);
      expect(result.errors).toBe(1);
      const location = await client!.query<{ geocode_source: string }>(
        "select geocode_source from company_directory_business_locations where profile_id = $1::uuid",
        [PROFILE_ID],
      );
      expect(location.rows[0]?.geocode_source).toBe("lantmateriet_transient_error_v4_2");
    });
  },
);
