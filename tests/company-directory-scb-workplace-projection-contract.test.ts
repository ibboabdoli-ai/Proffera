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

function workplace(
  municipality = "Södertälje",
  cfarNumber = "12345678",
): ScbCompanyRegistryEnrichment["workplaces"][number] {
  return {
    cfarNumber,
    name: null,
    phone: null,
    email: null,
    visitingAddress: {
      careOf: null,
      addressLine: "STORGATAN 1",
      postalCode: "151 00",
      city: "SÖDERTÄLJE",
    },
    postalAddress: {
      careOf: null,
      addressLine: "STORGATAN 1",
      postalCode: "151 00",
      city: "SÖDERTÄLJE",
    },
    municipality,
    sniCodes: ["43.210"],
    coordinates: null,
    source: "scb_foretagsregistret",
  };
}

function scbData(overrides: Partial<ScbCompanyRegistryEnrichment> = {}): ScbCompanyRegistryEnrichment {
  return {
    organizationNumber: "5563115707",
    legalName: "Projection AB",
    phone: null,
    email: null,
    postalAddress: {
      careOf: null,
      addressLine: null,
      postalCode: null,
      city: null,
    },
    municipality: "Jönköping",
    sniCodes: ["43.210"],
    workplaces: [workplace()],
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
    ...overrides,
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "SCB workplace municipality projection safety PostgreSQL integration",
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
      legalName: string;
      municipality?: string;
      claimedWorkspaceId?: string | null;
    }) {
      if (input.claimedWorkspaceId) {
        await client!.query(
          "insert into workspaces (id) values ($1) on conflict do nothing",
          [input.claimedWorkspaceId],
        );
      }

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, municipality, claimed_workspace_id
        ) values ($1, $2, 'juridical_person', $3, $3, $4, $5, $6)
      `, [
        input.profileId,
        input.organizationNumber,
        input.legalName,
        `projection-${input.profileId.slice(0, 8)}`,
        input.municipality ?? "",
        input.claimedWorkspaceId ?? null,
      ]);

      await client!.query(`
        insert into company_directory_official_facts (profile_id, sni_codes, last_synced_at)
        values ($1, '[{"code":"43.210"}]'::jsonb, now())
      `, [input.profileId]);
    }

    beforeAll(async () => {
      containerName = `proffera-scb-projection-${process.pid}-${Date.now()}`;
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
        const migration = readFileSync(join(process.cwd(), migrationPath), "utf8");
        await client.query(migration);
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

    it("does not project conflicted SCB evidence into the profile", async () => {
      const profileId = "11111111-1111-4111-8111-111111111111";
      await seedProfile({
        profileId,
        organizationNumber: "5563115707",
        legalName: "Official Name AB",
        municipality: "Stockholm",
      });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({ legalName: "Different Name AB" }),
      });

      const result = await enrichCompanyDirectoryScbForProfile(profileId);
      expect(result.status).toBe("saved");
      expect(result.conflicts.length).toBeGreaterThan(0);

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Stockholm");

      const projectedSources = await client!.query<{ count: number }>(`
        select count(*)::int as count
        from company_directory_field_sources
        where profile_id = $1
          and field_name = 'municipality'
          and source_name = 'scb_foretagsregistret:workplace'
      `, [profileId]);
      expect(projectedSources.rows[0]?.count).toBe(0);
    }, 30_000);

    it("does not overwrite claimed Workspace-owned municipality data", async () => {
      const profileId = "22222222-2222-4222-8222-222222222222";
      const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await seedProfile({
        profileId,
        organizationNumber: "5563115708",
        legalName: "Projection AB",
        municipality: "Stockholm",
        claimedWorkspaceId: workspaceId,
      });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({ organizationNumber: "5563115708" }),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Stockholm");

      const projectedSources = await client!.query<{ count: number }>(`
        select count(*)::int as count
        from company_directory_field_sources
        where profile_id = $1
          and field_name = 'municipality'
          and source_name = 'scb_foretagsregistret:workplace'
      `, [profileId]);
      expect(projectedSources.rows[0]?.count).toBe(0);
    }, 30_000);

    it("records workplace-specific provenance for a clean projection", async () => {
      const profileId = "33333333-3333-4333-8333-333333333333";
      await seedProfile({
        profileId,
        organizationNumber: "5563115709",
        legalName: "Projection AB",
      });
      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({
          organizationNumber: "5563115709",
          workplaces: [workplace("Södertälje", "87654321")],
        }),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Södertälje");

      const source = await client!.query<{
        source_name: string;
        source_record_id: string;
      }>(`
        select source_name, source_record_id
        from company_directory_field_sources
        where profile_id = $1 and field_name = 'municipality'
        order by observed_at desc
        limit 1
      `, [profileId]);
      expect(source.rows[0]).toEqual({
        source_name: "scb_foretagsregistret:workplace",
        source_record_id: "87654321",
      });
    }, 30_000);

    it("refreshes municipality when the same workplace provenance still owns the profile value", async () => {
      const profileId = "44444444-4444-4444-8444-444444444444";
      const organizationNumber = "5563115710";
      const cfarNumber = "87650000";
      const oldMunicipality = "Södertälje";
      const oldValueHash = createHash("sha256").update(oldMunicipality).digest("hex");

      await seedProfile({
        profileId,
        organizationNumber,
        legalName: "Projection AB",
        municipality: oldMunicipality,
      });
      await client!.query(`
        insert into company_directory_field_sources (
          profile_id, field_name, source_name, source_record_id,
          source_url, value_hash, confidence, observed_at
        ) values (
          $1, 'municipality', 'scb_foretagsregistret:workplace', $2,
          '', $3, 100, now() - interval '1 day'
        )
      `, [profileId, cfarNumber, oldValueHash]);

      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({
          organizationNumber,
          workplaces: [workplace("Nykvarn", cfarNumber)],
        }),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Nykvarn");

      const refreshedSource = await client!.query<{
        source_name: string;
        source_record_id: string;
        value_hash: string;
      }>(`
        select source_name, source_record_id, value_hash
        from company_directory_field_sources
        where profile_id = $1
          and field_name = 'municipality'
          and source_name = 'scb_foretagsregistret:workplace'
          and source_record_id = $2
          and value_hash = $3
        limit 1
      `, [
        profileId,
        cfarNumber,
        createHash("sha256").update("Nykvarn").digest("hex"),
      ]);
      expect(refreshedSource.rows).toHaveLength(1);
    }, 30_000);

    it("repairs a legacy company-level projection when its provenance still owns the profile value", async () => {
      const profileId = "55555555-5555-4555-8555-555555555555";
      const organizationNumber = "5563115711";
      const oldMunicipality = "Jönköping";

      await seedProfile({
        profileId,
        organizationNumber,
        legalName: "Projection AB",
        municipality: oldMunicipality,
      });
      await client!.query(`
        insert into company_directory_field_sources (
          profile_id, field_name, source_name, source_record_id,
          source_url, value_hash, confidence, observed_at
        ) values (
          $1, 'municipality', 'scb_foretagsregistret', $2,
          '', $3, 100, now() - interval '1 day'
        )
      `, [
        profileId,
        organizationNumber,
        createHash("sha256").update(oldMunicipality).digest("hex"),
      ]);

      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({
          organizationNumber,
          workplaces: [workplace("Södertälje", "87650001")],
        }),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Södertälje");

      const repairedSource = await client!.query<{
        source_name: string;
        source_record_id: string;
      }>(`
        select source_name, source_record_id
        from company_directory_field_sources
        where profile_id = $1
          and field_name = 'municipality'
          and source_name = 'scb_foretagsregistret:workplace'
        order by observed_at desc
        limit 1
      `, [profileId]);
      expect(repairedSource.rows[0]).toEqual({
        source_name: "scb_foretagsregistret:workplace",
        source_record_id: "87650001",
      });
    }, 30_000);

    it("does not repair a legacy projection after the profile value no longer matches its provenance hash", async () => {
      const profileId = "66666666-6666-4666-8666-666666666666";
      const organizationNumber = "5563115712";

      await seedProfile({
        profileId,
        organizationNumber,
        legalName: "Projection AB",
        municipality: "Stockholm",
      });
      await client!.query(`
        insert into company_directory_field_sources (
          profile_id, field_name, source_name, source_record_id,
          source_url, value_hash, confidence, observed_at
        ) values (
          $1, 'municipality', 'scb_foretagsregistret', $2,
          '', $3, 100, now() - interval '1 day'
        )
      `, [
        profileId,
        organizationNumber,
        createHash("sha256").update("Jönköping").digest("hex"),
      ]);

      mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
        status: "ok",
        data: scbData({
          organizationNumber,
          workplaces: [workplace("Södertälje", "87650002")],
        }),
      });

      await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toMatchObject({
        status: "saved",
        conflicts: [],
      });

      const profile = await client!.query<{ municipality: string }>(
        "select municipality from company_directory_profiles where id = $1",
        [profileId],
      );
      expect(profile.rows[0]?.municipality).toBe("Stockholm");

      const newProjection = await client!.query<{ count: number }>(`
        select count(*)::int as count
        from company_directory_field_sources
        where profile_id = $1
          and source_name = 'scb_foretagsregistret:workplace'
      `, [profileId]);
      expect(newProjection.rows[0]?.count).toBe(0);
    }, 30_000);
  },
);
