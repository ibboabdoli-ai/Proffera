import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  createTransport: vi.fn(),
  assessConfidence: vi.fn(),
  invalidateAuthority: vi.fn(),
  invalidatePublic: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createTransport,
}));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-authority-cache", () => ({
  invalidateCompanyDirectoryAuthorityCachesBestEffort: mocks.invalidateAuthority,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidatePublic,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "../src/lib/company-directory-ready-scb-enrichment";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "../src/lib/company-directory-ready-auto-publish";
import { publishCompanyDirectoryProfileIfSafe } from "../src/lib/company-directory-publication";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const CASES = [
  { n: 1, organizationNumber: "9999946001", city: "Stockholm", scbName: "QA946 Elektriker Test 1 AB", error: false, expected: "published" },
  { n: 2, organizationNumber: "9999946002", city: "Södertälje", scbName: "QA946 Elektriker Test 2 AB", error: false, expected: "published" },
  { n: 3, organizationNumber: "9999946003", city: "Stockholm", scbName: "Other Business AB", error: false, expected: "ready" },
  { n: 4, organizationNumber: "9999946004", city: "Uppsala", scbName: "QA946 Elektriker Test 4 AB", error: false, expected: "ready" },
  { n: 5, organizationNumber: "9999946005", city: "Stockholm", scbName: "QA946 Elektriker Test 5 AB", error: true, expected: "ready" },
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
    return (await client.query(query, values)).rows;
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Ready SCB → official workplace → guarded publication (five synthetic companies)",
  () => {
    let container = "";
    let client: Client | null = null;

    beforeAll(async () => {
      container = `qa946-scb-integration-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", container,
        "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=qa946", "-p", "127.0.0.1::5432", "postgres:16-alpine",
      ]);
      const portLine = docker(["port", container, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error("Could not find isolated QA PostgreSQL port");
      const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/qa946`;
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
      await client.query(` 
        create table company_directory_profiles (
          id uuid primary key,
          country_code text not null default 'SE',
          organization_number text not null unique,
          organization_kind text not null default 'juridical_person',
          legal_name text not null, display_name text not null, public_slug text not null,
          category_slug text not null, primary_sni_code text not null,
          activity_description text not null, address_line1 text not null,
          postal_code text not null, city text not null, municipality text not null,
          publication_status text not null default 'ready', is_active boolean not null default true,
          privacy_blocked boolean not null default false, auto_public_eligible boolean not null default true,
          claimed_workspace_id uuid, last_synced_at timestamptz not null,
          updated_at timestamptz not null, published_at timestamptz
        );
        create table company_directory_official_facts (
          profile_id uuid primary key,
          source_payload_hash text not null,
          registered_names jsonb not null default '[]'::jsonb,
          sni_codes jsonb not null default '[]'::jsonb,
          last_synced_at timestamptz not null,
          updated_at timestamptz not null default now(),
          deregistration_date date, advertising_blocked boolean not null default false,
          ongoing_procedures jsonb not null default '[]'::jsonb
        );
        create table company_directory_scb_enrichment (
          profile_id uuid primary key, organization_number text not null,
          observed_company_name text not null, phone text not null, email text not null,
          postal_address jsonb not null, municipality text not null,
          sni_codes jsonb not null, workplaces jsonb not null,
          provenance jsonb not null, conflicts jsonb not null,
          source_payload_hash text not null,
          last_synced_at timestamptz not null, updated_at timestamptz not null
        );
        create table company_directory_field_sources (
          profile_id uuid not null, field_name text not null, source_name text not null,
          source_record_id text not null, source_url text not null,
          value_hash text not null, confidence integer not null, observed_at timestamptz not null,
          unique(profile_id, field_name, source_name, value_hash)
        );
        create table company_directory_discovery_queue (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid, country_code text not null default 'SE',
          organization_number text not null, state text not null,
          verified_at timestamptz, locked_at timestamptz, lock_token uuid,
          last_error text not null default '', next_attempt_at timestamptz not null default now()
        );
      `);
    }, 120_000);

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (container) {
        try { docker(["stop", container]); } catch { /* Container may have exited. */ }
      }
    }, 30_000);

    afterEach(() => vi.unstubAllEnvs());

    it("processes five companies in bounded batches, publishes only two safe workplaces, and preserves three Ready", async () => {
      if (!client) throw new Error("Missing isolated QA database");
      vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
      vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");
      vi.stubEnv("SCB_COMPANY_REGISTRY_ENABLED", "");

      for (const company of CASES) {
        const id = `00000000-0000-4000-8000-${String(company.n).padStart(12, "0")}`;
        const name = `QA946 Elektriker Test ${company.n} AB`;
        await client.query(`
          insert into company_directory_profiles (
            id, organization_number, legal_name, display_name, public_slug,
            category_slug, primary_sni_code, activity_description, address_line1,
            postal_code, city, municipality, last_synced_at, updated_at
          ) values ($1,$2,$3,$3,$4,'elektriker','43.210','Elinstallation och service',
                    'Registered QA Street 1','111 11','Stockholm','Stockholm',
                    now() - interval '1 minute', now() - interval '1 minute')
        `, [id, company.organizationNumber, name, `qa946-elektriker-${company.n}`]);
        await client.query(`
          insert into company_directory_official_facts (
            profile_id,source_payload_hash,registered_names,sni_codes,last_synced_at
          ) values ($1,$2,$3::jsonb,$4::jsonb,now())
        `, [id, `synthetic-facts-${company.n}`,
          JSON.stringify([{ name, typeCode: "FORETAGSNAMN" }]),
          JSON.stringify([{ code: "43.210", label: "Elinstallationer" }])]);
        await client.query(`
          insert into company_directory_discovery_queue (profile_id,organization_number,state)
          values ($1,$2,'ready')
        `, [id, company.organizationNumber]);
      }

      const fetchCompany = vi.fn(async (organizationNumber: string) => {
        const found = CASES.find((entry) => entry.organizationNumber === organizationNumber);
        if (!found) throw new Error("Unexpected synthetic SCB company lookup");
        return [{ OrgNr: organizationNumber, Företagsnamn: found.scbName, SNI: "43210" }];
      });
      const fetchWorkplaces = vi.fn(async (organizationNumber: string) => {
        const found = CASES.find((entry) => entry.organizationNumber === organizationNumber);
        if (!found) throw new Error("Unexpected synthetic SCB workplace lookup");
        if (found.error) throw new Error("Simulated SCB outage (no network)");
        return [{
          OrgNr: organizationNumber, CfarNr: `CFAR-QA-${found.n}`,
          BesöksAdress: "QA Test Street 2", BesöksPostNr: "11122",
          BesöksPostOrt: found.city, Kommunnamn: found.city, SNI: "43210",
        }];
      });

      mocks.getSql.mockReturnValue(postgresSql(client));
      mocks.createTransport.mockReturnValue({ fetchCompany, fetchWorkplaces });
      mocks.assessConfidence.mockReturnValue({ score: 100, officialFactsReady: true });
      mocks.invalidateAuthority.mockResolvedValue(undefined);
      mocks.invalidatePublic.mockReturnValue(undefined);

      // No API network call can occur: the explicitly passed SCB transport is synthetic.
      for (let run = 0; run < 3; run += 1) {
        const preflight = await enrichReadyCompanyDirectoryScbBatch({ limit: 3 });
        expect(preflight.attempted).toBeLessThanOrEqual(3);
        expect(preflight.errors).toBeLessThanOrEqual(1);
        const beforePublication = await client.query<{ count: string }>(
          "select count(*)::text as count from company_directory_profiles where publication_status = 'published'"
        );
        expect(Number(beforePublication.rows[0]?.count)).toBe(0);
        const state = await client.query<{ count: string }>(
          "select count(*)::text as count from company_directory_scb_enrichment"
        );
        if (Number(state.rows[0]?.count) >= 4) break;
      }

      const scbRows = await client.query<{organization_number:string;conflicts:unknown;workplaces:unknown}>(
        "select organization_number, conflicts, workplaces from company_directory_scb_enrichment order by organization_number"
      );
      expect(scbRows.rows).toHaveLength(4);
      const conflict = scbRows.rows.find((row) => row.organization_number === CASES[2].organizationNumber);
      expect(conflict?.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({code:"legal_name_mismatch"})]));
      const outside = scbRows.rows.find((row) => row.organization_number === CASES[3].organizationNumber);
      expect(outside?.workplaces).toEqual(expect.arrayContaining([expect.objectContaining({ municipality: "Uppsala" })]));
      expect(scbRows.rows.some((row) => row.organization_number === CASES[4].organizationNumber)).toBe(false);

      // The actual Ready worker uses the same SQL protection used in Production.
      const published = await autoPublishReadyHighConfidenceCompanyDirectoryBatch(5);
      expect(published).toMatchObject({ published: 2, queueSynced: 2, errors: 0 });
      expect(mocks.invalidatePublic).toHaveBeenCalledTimes(2);

      const final = await client.query<{organization_number:string;publication_status:string;queue_state:string}>(
        `select p.organization_number,p.publication_status,q.state as queue_state
        from company_directory_profiles p join company_directory_discovery_queue q on q.profile_id=p.id
        order by p.organization_number`
      );
      expect(final.rows.map((row) => row.publication_status)).toEqual(
        CASES.map((row) => row.expected)
      );
      expect(final.rows.map((row) => row.queue_state)).toEqual(
        ["published", "published", "ready", "ready", "ready"]
      );

      // Direct publication cannot bypass conflict, geography, or unavailable SCB.
      for (const n of [3,4,5]) {
        const id = `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
        const result = await publishCompanyDirectoryProfileIfSafe(id);
        expect(result.ok).toBe(false);
      }

      // No synthetic company may contact SCB except through our in-memory transport.
      expect(fetchCompany.mock.calls.length).toBeLessThanOrEqual(9);
      expect(fetchWorkplaces.mock.calls.length).toBeLessThanOrEqual(9);
      expect(mocks.createTransport).toHaveBeenCalled();
    }, 90_000);
  },
);
