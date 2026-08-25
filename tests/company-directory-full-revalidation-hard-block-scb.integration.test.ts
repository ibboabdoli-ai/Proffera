import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
  enrichOfficialFacts: vi.fn(),
  enrichScb: vi.fn(),
  createScbTransport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichOfficialFacts,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createScbTransport,
}));

import { revalidateAllCompanyDirectoryBatch } from "../src/lib/company-directory-full-revalidation";
import { ScbCompanyRegistryMatchCountError } from "../src/lib/company-directory-scb-provider";

const RUN_POSTGRES_INTEGRATION = process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const READY_PROFILE_ID = "41000000-0000-4000-8000-000000000001";
const REVIEW_PROFILE_ID = "41000000-0000-4000-8000-000000000002";
const READY_ORG = "5594022609";
const REVIEW_ORG = "9697794064";

const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

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
  "full Directory hard-block and SCB quarantine PostgreSQL integration",
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

    async function applyMigration(path: string) {
      const migration = readFileSync(new URL(path, import.meta.url), "utf8");
      await client!.query(migration);
    }

    async function seedProfile(input: {
      id: string;
      organizationNumber: string;
      status: "published" | "ready" | "review";
      lastSyncedAgo?: string;
      updatedAgo?: string;
    }) {
      await client!.query(`
        insert into company_directory_profiles (
          id,
          organization_number,
          legal_name,
          display_name,
          public_slug,
          publication_status,
          country_code,
          organization_kind,
          category_slug,
          primary_sni_code,
          activity_description,
          city,
          quality_score,
          is_active,
          privacy_blocked,
          auto_public_eligible,
          claimed_workspace_id,
          last_synced_at,
          updated_at
        ) values (
          $1::uuid,
          $2,
          'Example AB',
          'Example AB',
          $3,
          $4,
          'SE',
          'juridical_person',
          'bygg',
          '43.320',
          'Byggverksamhet',
          'Stockholm',
          95,
          true,
          false,
          true,
          null,
          now() - $5::interval,
          now() - $6::interval
        )
      `, [
        input.id,
        input.organizationNumber,
        `example-${input.organizationNumber}`,
        input.status,
        input.lastSyncedAgo ?? "1 day",
        input.updatedAgo ?? "1 day",
      ]);
    }

    async function seedFacts(input: {
      profileId: string;
      procedures?: unknown[];
      syncedAgo?: string;
      hash?: string;
    }) {
      await client!.query(`
        insert into company_directory_official_facts (
          profile_id,
          source_payload_hash,
          last_synced_at,
          ongoing_procedures
        ) values (
          $1::uuid,
          $2,
          now() - $3::interval,
          $4::jsonb
        )
      `, [
        input.profileId,
        input.hash ?? "fresh-facts",
        input.syncedAgo ?? "0 seconds",
        JSON.stringify(input.procedures ?? []),
      ]);
    }

    async function seedExistingScb(input: {
      profileId: string;
      organizationNumber: string;
      hash?: string;
      syncedAgo?: string;
    }) {
      await client!.query(`
        insert into company_directory_scb_enrichment (
          profile_id,
          organization_number,
          source_payload_hash,
          last_synced_at,
          provenance
        ) values (
          $1::uuid,
          $2,
          $3,
          now() - $4::interval,
          '{}'::jsonb
        )
      `, [
        input.profileId,
        input.organizationNumber,
        input.hash ?? "old-scb",
        input.syncedAgo ?? "8 days",
      ]);
    }

    beforeAll(async () => {
      containerName = `proffera-hard-block-scb-${process.pid}-${Date.now()}`;
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
      await applyMigration("../db/migrations/20260809_0037_company_profile_engine_foundation.sql");
      await applyMigration("../db/migrations/20260810_0043_company_profile_discovery_queue.sql");
      await applyMigration("../db/migrations/20260812_0044_company_directory_official_facts.sql");
      await applyMigration("../db/migrations/20260819_0048_company_directory_scb_enrichment.sql");
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
      await client!.query(`
        truncate table
          company_directory_discovery_queue,
          company_directory_source_snapshots,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_claims,
          company_directory_media,
          company_directory_field_sources,
          company_directory_profiles,
          company_directory_sync_runs
        restart identity cascade
      `);

      for (const mock of Object.values(mocks)) mock.mockReset();
      transport.fetchCompany.mockReset();
      transport.fetchWorkplaces.mockReset();

      mocks.getSql.mockReturnValue(postgresSql(client!));
      mocks.createScbTransport.mockReturnValue(transport);
      mocks.enrichOfficialFacts.mockImplementation(async (profileId: string) => ({
        profileId,
        organizationNumber: profileId === REVIEW_PROFILE_ID ? REVIEW_ORG : READY_ORG,
        reusedVerifiedDetail: false,
      }));
      mocks.enrichScb.mockResolvedValue({ status: "deferred", saved: false, conflicts: [] });
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
    });

    it("uses the canonical Directory migration schema", async () => {
      const columns = await client!.query<{ table_name: string; column_name: string }>(`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (
            (table_name = 'company_directory_profiles' and column_name = 'quality_score')
            or (table_name = 'company_directory_official_facts' and column_name = 'deregistration_reason_code')
          )
        order by table_name, column_name
      `);
      expect(columns.rows).toEqual([
        { table_name: "company_directory_official_facts", column_name: "deregistration_reason_code" },
        { table_name: "company_directory_profiles", column_name: "quality_score" },
      ]);

      const constraints = await client!.query<{ conname: string }>(`
        select conname
        from pg_constraint
        where conrelid = 'company_directory_discovery_queue'::regclass
      `);
      const names = constraints.rows.map((row) => row.conname);
      expect(names).toContain("company_directory_discovery_queue_state_check");
      expect(names).toContain("company_directory_discovery_queue_profile_id_fkey");
    }, 30_000);

    it("demotes a persisted hard-blocked Ready profile before SCB configuration is required", async () => {
      await seedProfile({ id: READY_PROFILE_ID, organizationNumber: READY_ORG, status: "ready" });
      await seedFacts({
        profileId: READY_PROFILE_ID,
        procedures: [{ code: "KK", label: "Konkurs", fromDate: "2026-08-04" }],
      });
      mocks.createScbTransport.mockReturnValue(null);

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        skipped: true,
        reason: "scb_access_not_configured",
        selected: 1,
        movedToReview: 1,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const row = await client!.query<{ publication_status: string }>(
        "select publication_status from company_directory_profiles where id = $1::uuid",
        [READY_PROFILE_ID],
      );
      expect(row.rows[0]?.publication_status).toBe("review");
    }, 30_000);

    it("demotes a newly hard-blocked Ready profile immediately after Official Facts refresh", async () => {
      await seedProfile({ id: READY_PROFILE_ID, organizationNumber: READY_ORG, status: "ready" });
      await seedFacts({ profileId: READY_PROFILE_ID, syncedAgo: "2 days" });

      mocks.enrichOfficialFacts.mockImplementation(async () => {
        await client!.query(`
          update company_directory_official_facts
          set source_payload_hash = 'refreshed-hard-block',
              ongoing_procedures = $2::jsonb,
              last_synced_at = now(),
              updated_at = now()
          where profile_id = $1::uuid
        `, [
          READY_PROFILE_ID,
          JSON.stringify([{ code: "KK", label: "Konkurs", fromDate: "2026-08-24" }]),
        ]);
        return {
          profileId: READY_PROFILE_ID,
          organizationNumber: READY_ORG,
          reusedVerifiedDetail: false,
        };
      });
      mocks.enrichScb.mockRejectedValue(new Error("SCB must not run after a hard block is refreshed"));

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        selected: 1,
        refreshed: 1,
        movedToReview: 1,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).not.toHaveBeenCalled();

      const row = await client!.query<{ publication_status: string }>(
        "select publication_status from company_directory_profiles where id = $1::uuid",
        [READY_PROFILE_ID],
      );
      expect(row.rows[0]?.publication_status).toBe("review");
    }, 30_000);

    it("clears existing SCB evidence when a deterministic match-count failure is quarantined", async () => {
      await seedProfile({ id: READY_PROFILE_ID, organizationNumber: READY_ORG, status: "ready" });
      await seedFacts({ profileId: READY_PROFILE_ID });
      await seedExistingScb({ profileId: READY_PROFILE_ID, organizationNumber: READY_ORG });
      mocks.enrichScb.mockRejectedValue(new ScbCompanyRegistryMatchCountError());

      const first = await revalidateAllCompanyDirectoryBatch(10);
      expect(first).toMatchObject({ selected: 1, movedToReview: 1, errors: 0, remaining: 0 });

      const row = await client!.query<{
        publication_status: string;
        source_payload_hash: string;
        failure_code: string | null;
      }>(`
        select
          profile.publication_status,
          scb.source_payload_hash,
          scb.provenance #>> '{revalidationFailure,code}' as failure_code
        from company_directory_profiles profile
        join company_directory_scb_enrichment scb on scb.profile_id = profile.id
        where profile.id = $1::uuid
      `, [READY_PROFILE_ID]);
      expect(row.rows[0]).toMatchObject({
        publication_status: "review",
        source_payload_hash: "",
        failure_code: "company_match_count",
      });

      mocks.enrichOfficialFacts.mockClear();
      mocks.enrichScb.mockClear();
      const second = await revalidateAllCompanyDirectoryBatch(10);
      expect(second).toMatchObject({ selected: 0, errors: 0, remaining: 0 });
      expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);

    it("rechecks a reversible hard-blocked Review profile after 24 hours without calling SCB while blocked", async () => {
      await seedProfile({
        id: REVIEW_PROFILE_ID,
        organizationNumber: REVIEW_ORG,
        status: "review",
        updatedAgo: "2 days",
      });
      await seedFacts({
        profileId: REVIEW_PROFILE_ID,
        procedures: [{ code: "FUOL", label: "Överlåtande i fusion", fromDate: "2026-05-04" }],
        syncedAgo: "2 days",
      });
      mocks.enrichOfficialFacts.mockImplementation(async () => {
        await client!.query(`
          update company_directory_official_facts
          set last_synced_at = now(), updated_at = now()
          where profile_id = $1::uuid
        `, [REVIEW_PROFILE_ID]);
        return {
          profileId: REVIEW_PROFILE_ID,
          organizationNumber: REVIEW_ORG,
          reusedVerifiedDetail: false,
        };
      });
      mocks.enrichScb.mockRejectedValue(new Error("SCB must not run while the refreshed legal block persists"));

      const result = await revalidateAllCompanyDirectoryBatch(10);

      expect(result).toMatchObject({
        selected: 1,
        refreshed: 1,
        kept: 1,
        movedToReview: 0,
        errors: 0,
        remaining: 0,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    }, 30_000);
  },
);
