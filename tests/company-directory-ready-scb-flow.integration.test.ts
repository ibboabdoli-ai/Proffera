import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  createTransport: vi.fn(),
  invalidatePublic: vi.fn(),
  invalidateAuthority: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createTransport,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidatePublic,
}));
vi.mock("@/lib/company-directory-authority-cache", () => ({
  invalidateCompanyDirectoryAuthorityCachesBestEffort: mocks.invalidateAuthority,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "@/lib/company-directory-ready-scb-enrichment";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-ready-auto-publish";

const ACTIVE = process.env.PROFFERA_POSTGRES_INTEGRATION === "1"
  || (process.env.GITHUB_ACTIONS === "true"
    && process.env.GITHUB_HEAD_REF === "work/proffera-ready-scb-controlled-20261017");
const TEST_ORGS = Array.from({ length: 5 }, (_, index) => `9999946${String(index + 1).padStart(3, "0")}`);
const CASES = ["safe-stockholm", "safe-sodertalje", "outside-pilot", "name-conflict", "ambiguous-workplaces"] as const;

type Scenario = typeof CASES[number];

const registryTransport = {
  fetchCompany: vi.fn(async (org: string) => {
    const index = TEST_ORGS.indexOf(org);
    if (index < 0) throw new Error("Unexpected QA identity");
    const name = `QA946 Elektriker Test ${index + 1} AB`;
    // An intentional SCB vs Bolagsverket legal-name conflict must fail closed.
    const reportedName = CASES[index] === "name-conflict" ? "Unrelated Company AB" : name;
    return [{ OrgNr: org, Foretagsnamn: reportedName, SNI: "43210" }];
  }),
  fetchWorkplaces: vi.fn(async (org: string) => {
    const index = TEST_ORGS.indexOf(org);
    if (index < 0) throw new Error("Unexpected QA identity");
    const scenario: Scenario = CASES[index];
    const visitingCity = scenario === "outside-pilot" ? "Uppsala"
      : scenario === "safe-sodertalje" ? "Södertälje" : "Stockholm";
    const municipality = visitingCity;
    const workplace = (suffix: number) => ({
      OrgNr: org,
      CfarNr: `QA946${index}${suffix}`,
      BesoksAdress: `Testgatan ${suffix}`,
      BesoksPostNr: "11122",
      BesoksPostOrt: visitingCity,
      Kommunnamn: municipality,
      SNI: "43210",
    });
    return scenario === "ambiguous-workplaces" ? [workplace(1), workplace(2)] : [workplace(1)];
  }),
};

function postgresSql(client: Client) {
  return async (segments: TemplateStringsArray, ...values: unknown[]) => {
    let query = segments[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${segments[index + 1] ?? ""}`;
    }
    return (await client.query(query, values)).rows;
  };
}

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(ACTIVE ? describe.sequential : describe.skip)(
  "PR #946 Ready -> mock SCB -> real PostgreSQL publication safety",
  () => {
    let client: Client | null = null;
    let containerName = "";

    beforeAll(async () => {
      vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
      vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");
      vi.stubEnv("SCB_COMPANY_REGISTRY_ENABLED", "false");

      containerName = `proffera-qa946-${process.pid}-${Date.now()}`;
      docker([
        "run", "-d", "--rm", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_qa946",
        "-p", "127.0.0.1::5432", "postgres:16-alpine",
      ]);
      const port = docker(["port", containerName, "5432/tcp"]).match(/:(\d+)\s*$/u)?.[1];
      if (!port) throw new Error("Could not resolve isolated PostgreSQL test port");
      const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_qa946`;

      for (let retry = 0; retry < 80; retry += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          client = probe;
          break;
        } catch {
          await probe.end().catch(() => undefined);
          await delay(500);
        }
      }
      if (!client) throw new Error("Isolated PostgreSQL never became ready");

      await client.query("create table workspaces (id uuid primary key)");
      for (const migration of [
        "../db/migrations/20260809_0037_company_profile_engine_foundation.sql",
        "../db/migrations/20260810_0043_company_profile_discovery_queue.sql",
        "../db/migrations/20260812_0044_company_directory_official_facts.sql",
        "../db/migrations/20260819_0048_company_directory_scb_enrichment.sql",
      ]) {
        await client.query(readFileSync(new URL(migration, import.meta.url), "utf8"));
      }

      // All five company and official-facts records are synthetic. None may
      // ever be used to call the live SCB registry.
      for (let index = 0; index < CASES.length; index += 1) {
        const org = TEST_ORGS[index];
        const name = `QA946 Elektriker Test ${index + 1} AB`;
        const inserted = await client.query<{ id: string }>(`
          insert into company_directory_profiles (
            organization_number, legal_name, display_name, public_slug,
            publication_status, country_code, organization_kind, category_slug,
            primary_sni_code, activity_description, address_line1, postal_code,
            city, municipality, quality_score, is_active, privacy_blocked,
            auto_public_eligible, last_synced_at, updated_at
          ) values ($1, $2, $2, $3, 'ready', 'SE', 'juridical_person', 'elektriker',
            '43.210', 'Elinstallation och service', 'Registrerad gata 1',
            '111 11', 'Stockholm', 'Stockholm', 95, true, false, true,
            now() - interval '5 minutes', now() - interval '5 minutes')
          returning id::text
        `, [org, name, `qa946-${index + 1}`]);
        const id = inserted.rows[0]?.id;
        if (!id) throw new Error("Synthetic fixture failed");

        await client.query(`
          insert into company_directory_official_facts (
            profile_id, source_payload_hash, last_synced_at,
            registered_names, sni_codes, ongoing_procedures, advertising_blocked
          ) values (
            $1::uuid, $2, now() - interval '1 minute',
            $3::jsonb, $4::jsonb, '[]'::jsonb, false
          )
        `, [
          id, `synthetic-qa946-hash-${index}`,
          JSON.stringify([{ name, typeCode: "FORETAGSNAMN" }]),
          JSON.stringify([{ code: "43.210", label: "Elinstallationer" }]),
        ]);
        await client.query(`
          insert into company_directory_discovery_queue (
            organization_number, provider, state, profile_id,
            country_code, primary_sni_code
          ) values ($1, 'qa946_mock', 'ready', $2::uuid, 'SE', '43210')
        `, [org, id]);
      }

      mocks.getSql.mockReturnValue(postgresSql(client));
      mocks.createTransport.mockReturnValue(registryTransport);
      mocks.invalidatePublic.mockReset();
      mocks.invalidateAuthority.mockReset();
    }, 120_000);

    afterAll(async () => {
      vi.unstubAllEnvs();
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // Container is already gone: still no Production resources touched.
        }
      }
    }, 30_000);

    it("keeps all five synthetic Ready profiles private before SCB evidence exists", async () => {
      const first = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
      expect(first).toMatchObject({ published: 0, safetyEligible: 0 });
      const result = await client!.query(`
        select publication_status, count(*)::int as total
        from company_directory_profiles
        group by publication_status
      `);
      expect(result.rows).toEqual([{ publication_status: "ready", total: 5 }]);
      expect(registryTransport.fetchCompany).not.toHaveBeenCalled();
    });

    it("retrieves simulated SCB data for precisely five candidates in bounded batches", async () => {
      let attempted = 0;
      let saved = 0;
      for (let run = 0; run < 3; run += 1) {
        const batch = await enrichReadyCompanyDirectoryScbBatch({ limit: 2 });
        expect(batch.errors).toBe(0);
        expect(batch.attempted).toBeLessThanOrEqual(2);
        attempted += batch.attempted;
        saved += batch.saved;
      }
      expect(attempted).toBe(5);
      expect(saved).toBe(5);
      expect(registryTransport.fetchCompany).toHaveBeenCalledTimes(5);
      expect(registryTransport.fetchWorkplaces).toHaveBeenCalledTimes(5);

      const rows = await client!.query(`
        select p.organization_number,
               jsonb_array_length(s.workplaces) as workplaces,
               jsonb_array_length(s.conflicts) as conflicts,
               (s.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = p.updated_at::text
                  and s.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = f.last_synced_at::text)
                 as snapshot_matches
        from company_directory_profiles p
        join company_directory_scb_enrichment s on s.profile_id=p.id
        join company_directory_official_facts f on f.profile_id=p.id
        order by p.organization_number
      `);
      expect(rows.rows).toHaveLength(5);
      expect(rows.rows.every((row) => row.snapshot_matches)).toBe(true);
      expect(rows.rows.map((row) => Number(row.conflicts))).toEqual([0, 0, 0, 1, 0]);
      expect(rows.rows.map((row) => Number(row.workplaces))).toEqual([1, 1, 1, 1, 2]);
    }, 40_000);

    it("publishes only the two verified pilot workplaces; blocks three unsafe variants", async () => {
      const result = await autoPublishReadyHighConfidenceCompanyDirectoryBatch(10);
      expect(result.errors).toBe(0);
      expect(result.published).toBe(2);
      // The DB trigger may transition queue rows before explicit queue reconciliation.
      // Assert the persisted queue state below, not a particular update count.
      expect(result.queueSynced).toBeGreaterThanOrEqual(0);

      const rows = await client!.query(`
        select p.organization_number, p.publication_status, queue.state as queue_state
        from company_directory_profiles p
        join company_directory_discovery_queue queue on queue.profile_id=p.id
        order by p.organization_number
      `);
      expect(rows.rows.map((row) => row.publication_status)).toEqual([
        "published", "published", "ready", "ready", "ready",
      ]);
      expect(rows.rows.map((row) => row.queue_state)).toEqual([
        "published", "published", "ready", "ready", "ready",
      ]);
      expect(mocks.invalidatePublic).toHaveBeenCalledTimes(2);
    }, 40_000);

    it("cannot double-publish the same Ready rows on a repeated cron pass", async () => {
      const repeated = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
      expect(repeated.published).toBe(0);
      const count = await client!.query(`
        select count(*)::int as n
        from company_directory_profiles
        where publication_status='published'
      `);
      expect(count.rows[0].n).toBe(2);
    });
  },
);
