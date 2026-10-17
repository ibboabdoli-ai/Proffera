import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  createTransport: vi.fn(),
  invalidateAuthority: vi.fn(),
  invalidateProjection: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createTransport,
}));
vi.mock("@/lib/company-directory-authority-cache", () => ({
  invalidateCompanyDirectoryAuthorityCachesBestEffort: mocks.invalidateAuthority,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidateProjection,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "@/lib/company-directory-ready-scb-enrichment";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-ready-auto-publish";
import { publishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";

const RUN = process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
const ORG_PREFIX = "99999460";
const firstProfileId = "61000000-0000-4000-8000-000000000001";
const names = Array.from({ length: 5 }, (_, i) => `QA946 Elektriker Test ${i + 1} AB`);

function org(index: number) {
  return `${ORG_PREFIX}${String(index).padStart(2, "0")}`;
}
function profileId(index: number) {
  return `61000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
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
function rawWorkplace(organization: string, overrides: Record<string, unknown> = {}) {
  return {
    OrgNr: organization,
    CfarNr: "00000001",
    BesöksAdress: "QA Testgatan 1",
    BesöksPostNr: "11111",
    BesöksPostOrt: "Stockholm",
    Kommun: "Stockholm",
    "SNI-kod": "43210",
    ...overrides,
  };
}
const transport = {
  fetchCompany: vi.fn(async (organization: string) => {
    const index = Number(organization.slice(-2));
    return [{
      OrgNr: organization,
      Företagsnamn: index === 3 ? "Completely Different QA Entity AB" : names[index - 1],
      "SNI-kod": "43210",
    }];
  }),
  fetchWorkplaces: vi.fn(async (organization: string) => {
    const index = Number(organization.slice(-2));
    if (index === 2) {
      return [rawWorkplace(organization, { BesöksPostOrt: "Uppsala", Kommun: "Uppsala" })];
    }
    if (index === 4) {
      return [
        rawWorkplace(organization),
        rawWorkplace(organization, {
          CfarNr: "00000002", BesöksAdress: "QA Andra Gatan 2",
        }),
      ];
    }
    if (index === 5) {
      return [rawWorkplace(organization, { BesöksAdress: "" })];
    }
    return [rawWorkplace(organization)];
  }),
};

(RUN ? describe.sequential : describe.skip)(
  "PR946 Ready → mocked SCB → Published PostgreSQL end-to-end",
  () => {
    let containerName = "";
    let client: Client | null = null;

    async function applyMigration(path: string) {
      await client!.query(readFileSync(new URL(path, import.meta.url), "utf8"));
    }

    beforeAll(async () => {
      containerName = `proffera-pr946-scb-e2e-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_qa",
        "-p", "127.0.0.1::5432", "postgres:16-alpine",
      ]);
      const port = docker(["port", containerName, "5432/tcp"])
        .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error("Docker did not expose a PostgreSQL port");
      const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_qa`;

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
      await client.query("create table workspaces (id uuid primary key)");
      await applyMigration("../db/migrations/20260809_0037_company_profile_engine_foundation.sql");
      await applyMigration("../db/migrations/20260810_0043_company_profile_discovery_queue.sql");
      await applyMigration("../db/migrations/20260812_0044_company_directory_official_facts.sql");
      await applyMigration("../db/migrations/20260819_0048_company_directory_scb_enrichment.sql");
    }, 120_000);

    afterAll(async () => {
      vi.unstubAllEnvs();
      await client?.end().catch(() => undefined);
      if (containerName) {
        try { docker(["stop", containerName]); } catch { /* container already stopped */ }
      }
    }, 30_000);

    beforeEach(async () => {
      vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
      vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");
      vi.stubEnv("SCB_COMPANY_REGISTRY_ENABLED", "");
      for (const fn of Object.values(mocks)) fn.mockReset();
      transport.fetchCompany.mockClear();
      transport.fetchWorkplaces.mockClear();
      mocks.getSql.mockReturnValue(postgresSql(client!));
      mocks.createTransport.mockReturnValue(transport);
      mocks.invalidateAuthority.mockResolvedValue(undefined);

      await client!.query(
        "truncate table company_directory_discovery_queue, company_directory_scb_enrichment, company_directory_official_facts, company_directory_field_sources, company_directory_profiles cascade",
      );
      for (let index = 1; index <= 5; index += 1) {
        const id = profileId(index);
        const organization = org(index);
        const name = names[index - 1];
        await client!.query(`insert into company_directory_profiles
          (id, organization_number, legal_name, display_name, public_slug,
           country_code, organization_kind, publication_status, is_active,
           privacy_blocked, auto_public_eligible, category_slug, primary_sni_code,
           activity_description, quality_score, address_line1, postal_code,
           city, municipality, last_synced_at, updated_at)
          values ($1::uuid, $2, $3, $3, $4, 'SE', 'juridical_person',
                  'ready', true, false, true, 'elektriker', '43.210',
                  'Elinstallation och service av elanläggningar', 100,
                  'QA Registrerad Gata 1', '11111', 'Stockholm', 'Stockholm',
                  now() - interval '1 day', now() - interval '1 hour')`,
        [id, organization, name, `qa946-elektriker-${index}`]);
        await client!.query(`insert into company_directory_official_facts
           (profile_id, registered_names, sni_codes, source_payload_hash,
            last_synced_at, advertising_blocked, ongoing_procedures)
           values ($1::uuid, $2::jsonb, $3::jsonb, $4, now() - interval '1 minute', false, '[]'::jsonb)`,
        [id, JSON.stringify([{ name, typeCode: "FORETAGSNAMN" }]),
         JSON.stringify([{ code: "43210", label: "Elinstallationer" }]), `fixture-${organization}`]);
        await client!.query(`insert into company_directory_discovery_queue
          (country_code, organization_number, provider, profile_id, state)
          values ('SE', $1, 'qa_fixture_pr946', $2::uuid, 'ready')`,
        [organization, id]);
      }
    });

    it("enriches five mock companies in bounded batches and publishes only the one with safe official workplace", async () => {
      const before = await client!.query(`select publication_status, count(*)::int as n
        from company_directory_profiles group by publication_status`);
      expect(before.rows).toEqual([{ publication_status: "ready", n: 5 }]);

      // Verify that the opt-in worker uses the explicit mock transport while the
      // global SCB rollout flag is disabled. No real network request is possible.
      let attempted = 0;
      let saved = 0;
      for (let run = 0; run < 3; run += 1) {
        const result = await enrichReadyCompanyDirectoryScbBatch();
        expect(result.errors, result.errorSummary).toBe(0);
        expect(result.attempted).toBeLessThanOrEqual(2);
        attempted += result.attempted;
        saved += result.saved;
      }
      expect(attempted).toBe(5);
      expect(saved).toBe(5);
      expect(transport.fetchCompany).toHaveBeenCalledTimes(5);
      expect(transport.fetchWorkplaces).toHaveBeenCalledTimes(5);

      const scb = await client!.query(`select p.organization_number, s.conflicts,
        s.workplaces, s.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' as profile_token,
        p.updated_at::text as expected_token,
        s.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' as facts_token,
        f.last_synced_at::text as expected_facts_token
        from company_directory_profiles p
        join company_directory_official_facts f on f.profile_id = p.id
        join company_directory_scb_enrichment s on s.profile_id = p.id
        order by p.organization_number`);
      expect(scb.rows).toHaveLength(5);
      for (const row of scb.rows) {
        expect(row.profile_token).toBe(row.expected_token);
        expect(row.facts_token).toBe(row.expected_facts_token);
      }
      expect(scb.rows.find(row => row.organization_number === org(3))?.conflicts)
        .toEqual(expect.arrayContaining([expect.objectContaining({ code: "legal_name_mismatch" })]));
      expect(scb.rows.find(row => row.organization_number === org(4))?.workplaces).toHaveLength(2);
      expect(scb.rows.find(row => row.organization_number === org(5))?.workplaces[0]?.visitingAddress?.addressLine).toBeNull();

      const result = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
      expect(result.errors).toBe(0);
      expect(result.published).toBe(1);

      const profiles = await client!.query(`select organization_number, publication_status
         from company_directory_profiles order by organization_number`);
      expect(profiles.rows).toEqual([
        { organization_number: org(1), publication_status: "published" },
        { organization_number: org(2), publication_status: "ready" },
        { organization_number: org(3), publication_status: "ready" },
        { organization_number: org(4), publication_status: "ready" },
        { organization_number: org(5), publication_status: "ready" },
      ]);
      const queues = await client!.query(`select state from company_directory_discovery_queue
        where profile_id = $1::uuid`, [firstProfileId]);
      expect(queues.rows).toEqual([{ state: "published" }]);
      expect(mocks.invalidateProjection).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: firstProfileId }),
      );

      // A direct publication call on an excluded candidate must remain fail-closed.
      for (let index = 2; index <= 5; index += 1) {
        const blocked = await publishCompanyDirectoryProfileIfSafe(profileId(index));
        expect(blocked).toMatchObject({ ok: false, code: "unsafe" });
      }
    }, 120_000);
  },
);
