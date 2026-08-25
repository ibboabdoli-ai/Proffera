import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  fetchScbCompanyRegistryEnrichment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-provider", () => ({
  fetchScbCompanyRegistryEnrichment: mocks.fetchScbCompanyRegistryEnrichment,
}));

import type { ScbCompanyRegistryEnrichment } from "@/lib/company-directory-scb-provider";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const RUNTIME_MIGRATION_PATHS = [
  "db/migrations/20260809_0037_company_profile_engine_foundation.sql",
  "db/migrations/20260809_0038_company_profile_engine_provenance.sql",
  "db/migrations/20260812_0044_company_directory_official_facts.sql",
  "db/migrations/20260819_0048_company_directory_scb_enrichment.sql",
] as const;

const OFFICIAL_SOURCE = "bolagsverket_vardefulla_datamangder";

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

function observedHash(value: string) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function workplace(input: {
  cfar?: string;
  street?: string;
  postal?: string;
  city?: string;
  municipality?: string;
} = {}): ScbCompanyRegistryEnrichment["workplaces"][number] {
  return {
    cfarNumber: input.cfar ?? "53261756",
    name: null,
    phone: null,
    email: null,
    visitingAddress: {
      careOf: null,
      addressLine: input.street ?? "STÅNGJÄRNSGATAN 10",
      postalCode: input.postal ?? "753 23",
      city: input.city ?? "UPPSALA",
    },
    postalAddress: {
      careOf: null,
      addressLine: "JÄRNAGATAN 5",
      postalCode: "151 71",
      city: "SÖDERTÄLJE",
    },
    municipality: input.municipality ?? "Uppsala",
    sniCodes: ["43.210"],
    coordinates: null,
    source: "scb_foretagsregistret",
  };
}

function scbData(
  organizationNumber: string,
  workplaces: ScbCompanyRegistryEnrichment["workplaces"] = [workplace()],
): ScbCompanyRegistryEnrichment {
  return {
    organizationNumber,
    legalName: "Projection AB",
    phone: null,
    email: null,
    postalAddress: {
      careOf: null,
      addressLine: "JÄRNAGATAN 5",
      postalCode: "151 71",
      city: "SÖDERTÄLJE",
    },
    municipality: "Södertälje",
    sniCodes: ["43.210"],
    workplaces,
    source: "scb_foretagsregistret",
    provenance: {
      legalName: "scb_foretagsregistret",
      phone: "scb_foretagsregistret",
      email: "scb_foretagsregistret",
      postalAddress: "scb_foretagsregistret",
      municipality: "scb_foretagsregistret",
      sniCodes: "scb_foretagsregistret",
      workplaces: "scb_foretagsregistret",
    },
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Company Directory canonical workplace reprojection PostgreSQL integration",
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

    async function seedProfile(input: {
      profileId: string;
      organizationNumber: string;
      claimedWorkspaceId?: string | null;
      wrongFieldHash?: "addressLine1" | "postalCode" | "city" | "municipality";
    }) {
      if (input.claimedWorkspaceId) {
        await client!.query(
          "insert into workspaces (id) values ($1) on conflict do nothing",
          [input.claimedWorkspaceId],
        );
      }

      const values = {
        addressLine1: "Järnagatan 5",
        postalCode: "15171",
        city: "SÖDERTÄLJE",
        municipality: "Södertälje",
      };

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, address_line1, postal_code, city, municipality,
          official_source, source_record_id, claimed_workspace_id
        ) values ($1, $2, 'juridical_person', 'Projection AB', 'Projection AB',
          $3, $4, $5, $6, $7, $8, $2, $9)
      `, [
        input.profileId,
        input.organizationNumber,
        `projection-${input.profileId.slice(0, 8)}`,
        values.addressLine1,
        values.postalCode,
        values.city,
        values.municipality,
        OFFICIAL_SOURCE,
        input.claimedWorkspaceId ?? null,
      ]);

      await client!.query(`
        insert into company_directory_official_facts (profile_id, sni_codes, last_synced_at)
        values ($1, '[{"code":"43.210"}]'::jsonb, now())
      `, [input.profileId]);

      for (const [fieldName, value] of Object.entries(values)) {
        const valueHash = input.wrongFieldHash === fieldName
          ? observedHash(`manual-${value}`)
          : observedHash(value);
        await client!.query(`
          insert into company_directory_field_sources (
            profile_id, field_name, source_name, source_record_id,
            source_url, value_hash, confidence, observed_at
          ) values ($1, $2, $3, $4, '', $5, 100, now())
        `, [input.profileId, fieldName, OFFICIAL_SOURCE, input.organizationNumber, valueHash]);
      }
    }

    async function readLocation(profileId: string) {
      const result = await client!.query<{
        address_line1: string;
        postal_code: string;
        city: string;
        municipality: string;
      }>(`
        select address_line1, postal_code, city, municipality
        from company_directory_profiles
        where id = $1
      `, [profileId]);
      return result.rows[0];
    }

    beforeAll(async () => {
      containerName = `proffera-workplace-reprojection-${process.pid}-${Date.now()}`;
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

      await client.query("create table workspaces (id uuid primary key)");
      for (const migrationPath of RUNTIME_MIGRATION_PATHS) {
        await client.query(readFileSync(join(process.cwd(), migrationPath), "utf8"));
      }
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
      mocks.fetchScbCompanyRegistryEnrichment.mockReset();
      mocks.getSql.mockReturnValue(postgresSql(client!));
      await client!.query(`
        truncate table company_directory_field_sources, company_directory_scb_enrichment,
          company_directory_official_facts, company_directory_profiles, workspaces cascade
      `);
    });

    it("reprojects postal/company address into one coherent workplace visiting-address bundle", async () => {
      const profileId = "11111111-1111-4111-8111-111111111111";
      const organizationNumber = "5563115707";
      await seedProfile({ profileId, organizationNumber });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData(organizationNumber),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      expect(await readLocation(profileId)).toEqual({
        address_line1: "STÅNGJÄRNSGATAN 10",
        postal_code: "753 23",
        city: "UPPSALA",
        municipality: "Uppsala",
      });

      const sources = await client!.query<{ field_name: string; source_record_id: string }>(`
        select field_name, source_record_id
        from company_directory_field_sources
        where profile_id = $1
          and source_name = 'scb_foretagsregistret:workplace'
        order by field_name
      `, [profileId]);
      expect(sources.rows).toEqual([
        { field_name: "addressLine1", source_record_id: "53261756" },
        { field_name: "city", source_record_id: "53261756" },
        { field_name: "municipality", source_record_id: "53261756" },
        { field_name: "postalCode", source_record_id: "53261756" },
      ]);
    }, 30_000);

    it("keeps the whole profile bundle unchanged when one field is no longer source-owned", async () => {
      const profileId = "22222222-2222-4222-8222-222222222222";
      const organizationNumber = "5563115708";
      await seedProfile({ profileId, organizationNumber, wrongFieldHash: "addressLine1" });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData(organizationNumber),
      });

      await enrichCompanyDirectoryScbForProfile(profileId);
      expect(await readLocation(profileId)).toEqual({
        address_line1: "Järnagatan 5",
        postal_code: "15171",
        city: "SÖDERTÄLJE",
        municipality: "Södertälje",
      });
    }, 30_000);

    it("does not overwrite a claimed Workspace-owned location", async () => {
      const profileId = "33333333-3333-4333-8333-333333333333";
      const organizationNumber = "5563115709";
      const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await seedProfile({ profileId, organizationNumber, claimedWorkspaceId: workspaceId });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData(organizationNumber),
      });

      await enrichCompanyDirectoryScbForProfile(profileId);
      expect((await readLocation(profileId))?.address_line1).toBe("Järnagatan 5");
    }, 30_000);

    it("fails closed for multiple workplaces", async () => {
      const profileId = "44444444-4444-4444-8444-444444444444";
      const organizationNumber = "5563115710";
      await seedProfile({ profileId, organizationNumber });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData(organizationNumber, [
          workplace(),
          workplace({
            cfar: "87654321",
            street: "RINGVÄGEN 85",
            postal: "118 61",
            city: "STOCKHOLM",
            municipality: "Stockholm",
          }),
        ]),
      });

      await enrichCompanyDirectoryScbForProfile(profileId);
      expect((await readLocation(profileId))?.address_line1).toBe("Järnagatan 5");
    }, 30_000);

    it("does not project a stale SCB response after the profile changes during fetch", async () => {
      const profileId = "55555555-5555-4555-8555-555555555555";
      const organizationNumber = "5563115711";
      await seedProfile({ profileId, organizationNumber });
      mocks.fetchScbCompanyRegistryEnrichment.mockImplementation(async () => {
        await client!.query(`
          update company_directory_profiles
          set updated_at = updated_at + interval '1 second'
          where id = $1
        `, [profileId]);
        return { status: "ok", data: scbData(organizationNumber) };
      });

      await enrichCompanyDirectoryScbForProfile(profileId);
      expect((await readLocation(profileId))?.address_line1).toBe("Järnagatan 5");

      const enrichment = await client!.query<{ count: number }>(`
        select count(*)::int as count
        from company_directory_scb_enrichment
        where profile_id = $1
      `, [profileId]);
      expect(enrichment.rows[0]?.count).toBe(1);
    }, 30_000);
  },
);
