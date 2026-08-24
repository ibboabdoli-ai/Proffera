import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Business Profile location migration PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

    const profileId = "11111111-1111-4111-8111-111111111111";
    const workspaceId = "22222222-2222-4222-8222-222222222222";

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
      containerName = `proffera-business-profile-location-${process.pid}-${Date.now()}`;
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
          id uuid primary key
        );
        create table company_directory_profiles (
          id uuid primary key
        );
        create table proffera_schema_migrations (
          migration_key text primary key,
          filename text not null unique,
          checksum text,
          git_sha text,
          applied_at timestamptz not null default now(),
          applied_by text not null,
          execution_mode text not null,
          notes text
        );
      `);

      const migrationSql = readFileSync(
        resolve(process.cwd(), "db/migrations/20260824_0067_business_profile_location_foundation.sql"),
        "utf8",
      );
      await client.query(migrationSql);

      await client.query("insert into workspaces (id) values ($1)", [workspaceId]);
      await client.query("insert into company_directory_profiles (id) values ($1)", [profileId]);
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

    it("executes the canonical migration and records the ledger row", async () => {
      const table = await client!.query(
        "select to_regclass('public.company_directory_profile_locations')::text as table_name",
      );
      const ledger = await client!.query(
        "select filename from proffera_schema_migrations where migration_key = '20260824_0067'",
      );

      expect(table.rows[0]?.table_name).toBe("company_directory_profile_locations");
      expect(ledger.rows).toEqual([
        { filename: "20260824_0067_business_profile_location_foundation.sql" },
      ]);
    });

    it("defaults new locations to private and non-visitable", async () => {
      const inserted = await client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, source_type, city, municipality
          ) values ($1, 'workplace', 'official', 'Södertälje', 'Södertälje')
          returning visibility, is_visitable
        `,
        [profileId],
      );

      expect(inserted.rows[0]).toEqual({ visibility: "private", is_visitable: false });
    });

    it("rejects registered and postal rows from exact public disclosure through the public-exact constraint", async () => {
      for (const purpose of ["registered", "postal"] as const) {
        await expect(client!.query(
          `
            insert into company_directory_profile_locations (
              profile_id, purpose, visibility, is_visitable, source_type, confirmed_at
            ) values ($1, $2, 'public', false, 'official', now())
          `,
          [profileId, purpose],
        )).rejects.toMatchObject({
          code: "23514",
          constraint: "company_directory_profile_locations_public_exact_check",
        });
      }
    });

    it("rejects visitability on a non-mappable registered purpose through the visitable-purpose constraint", async () => {
      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, visibility, is_visitable, source_type
          ) values ($1, 'registered', 'approximate', true, 'official')
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_visitable_purpose_check",
      });
    });

    it("requires owner provenance to identify a Workspace", async () => {
      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, source_type
          ) values ($1, 'workplace', 'owner')
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_owner_source_check",
      });

      const inserted = await client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, owner_workspace_id, purpose, source_type
          ) values ($1, $2, 'workplace', 'owner')
          returning owner_workspace_id::text
        `,
        [profileId, workspaceId],
      );
      expect(inserted.rows[0]?.owner_workspace_id).toBe(workspaceId);
    });

    it("requires confirmation and visitability before exact public disclosure", async () => {
      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, visibility, is_visitable, source_type
          ) values ($1, 'workplace', 'public', true, 'official')
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_public_exact_check",
      });

      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, visibility, is_visitable, source_type, confirmed_at
          ) values ($1, 'workplace', 'public', false, 'official', now())
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_public_exact_check",
      });

      const inserted = await client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, visibility, is_visitable, source_type,
            address_line1, postal_code, city, municipality,
            latitude, longitude, confirmed_at
          ) values (
            $1, 'workplace', 'public', true, 'official',
            'Storgatan 1', '151 00', 'Södertälje', 'Södertälje',
            59.1955, 17.6253, now()
          )
          returning visibility, is_visitable, latitude::float8, longitude::float8
        `,
        [profileId],
      );

      expect(inserted.rows[0]).toEqual({
        visibility: "public",
        is_visitable: true,
        latitude: 59.1955,
        longitude: 17.6253,
      });
    });

    it("rejects unpaired and out-of-range coordinates with the intended constraints", async () => {
      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, source_type, latitude
          ) values ($1, 'workplace', 'official', 59.1955)
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_coordinate_pair_check",
      });

      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, source_type, latitude, longitude
          ) values ($1, 'workplace', 'official', 91, 17.6253)
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_latitude_check",
      });

      await expect(client!.query(
        `
          insert into company_directory_profile_locations (
            profile_id, purpose, source_type, latitude, longitude
          ) values ($1, 'workplace', 'official', 59.1955, 181)
        `,
        [profileId],
      )).rejects.toMatchObject({
        code: "23514",
        constraint: "company_directory_profile_locations_longitude_check",
      });
    });
  },
);
