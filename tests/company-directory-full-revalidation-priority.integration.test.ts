import { execFileSync } from "node:child_process";
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

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const REVALIDATION_PROVIDER = "full_directory_revalidation";
const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

type SeedProfile = {
  id: string;
  organizationNumber: string;
  status: "published" | "ready" | "review" | "inactive" | "claimed";
};

const PROFILES = {
  publishedLow: {
    id: "10000000-0000-4000-8000-000000000001",
    organizationNumber: "5560000001",
    status: "published",
  },
  publishedHigh: {
    id: "10000000-0000-4000-8000-000000000002",
    organizationNumber: "5560000009",
    status: "published",
  },
  readyLow: {
    id: "10000000-0000-4000-8000-000000000003",
    organizationNumber: "5561000001",
    status: "ready",
  },
  readyHigh: {
    id: "10000000-0000-4000-8000-000000000004",
    organizationNumber: "5561000009",
    status: "ready",
  },
  review: {
    id: "10000000-0000-4000-8000-000000000005",
    organizationNumber: "5562000001",
    status: "review",
  },
  inactive: {
    id: "10000000-0000-4000-8000-000000000006",
    organizationNumber: "5563000001",
    status: "inactive",
  },
} satisfies Record<string, SeedProfile>;

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
  "full Directory revalidation Published safety priority PostgreSQL integration",
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

    async function seed(cursorValue: string, profiles: SeedProfile[]) {
      await client!.query(`
        truncate table company_directory_discovery_queue,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_profiles,
          company_directory_sync_runs
      `);

      await client!.query(`
        insert into company_directory_sync_runs (
          provider, status, cursor_value, started_at, completed_at
        ) values ($1, 'completed', $2, now() - interval '1 minute', now() - interval '1 minute')
      `, [REVALIDATION_PROVIDER, cursorValue]);

      for (const profile of profiles) {
        await client!.query(`
          insert into company_directory_profiles (
            id, organization_number, legal_name, display_name, publication_status,
            country_code, organization_kind, category_slug, primary_sni_code,
            activity_description, is_active, privacy_blocked, auto_public_eligible,
            claimed_workspace_id, last_synced_at, updated_at
          ) values (
            $1::uuid, $2, $3, $3, $4,
            'SE', 'juridical_person', 'elektriker', '43.210',
            'Elinstallation och service', true, false, true,
            null, now() - interval '1 day', now() - interval '1 day'
          )
        `, [profile.id, profile.organizationNumber, `Priority ${profile.organizationNumber} AB`, profile.status]);
      }
    }

    function selectedIds() {
      return mocks.enrichOfficialFacts.mock.calls.map((call) => String(call[0]));
    }

    async function latestCursor() {
      const result = await client!.query<{ cursor_value: string }>(`
        select cursor_value
        from company_directory_sync_runs
        where provider = $1
          and status = 'completed'
        order by started_at desc
        limit 1
      `, [REVALIDATION_PROVIDER]);
      return result.rows[0]?.cursor_value ?? "";
    }

    beforeAll(async () => {
      containerName = `proffera-revalidation-priority-${process.pid}-${Date.now()}`;
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
        create table company_directory_sync_runs (
          id uuid primary key default gen_random_uuid(),
          provider text not null,
          status text not null,
          cursor_value text not null default '',
          started_at timestamptz not null default now(),
          completed_at timestamptz,
          scanned_count integer not null default 0,
          upserted_count integer not null default 0,
          published_count integer not null default 0,
          blocked_count integer not null default 0,
          error_count integer not null default 0,
          error_summary text not null default ''
        );
        create table company_directory_profiles (
          id uuid primary key,
          organization_number text not null,
          legal_name text not null,
          display_name text not null,
          publication_status text not null,
          country_code text not null,
          organization_kind text not null,
          category_slug text not null,
          primary_sni_code text not null,
          activity_description text not null default '',
          is_active boolean not null default true,
          privacy_blocked boolean not null default false,
          auto_public_eligible boolean not null default true,
          claimed_workspace_id uuid,
          last_synced_at timestamptz not null,
          updated_at timestamptz not null,
          published_at timestamptz
        );
        create table company_directory_official_facts (
          profile_id uuid primary key,
          source_payload_hash text not null default '',
          last_synced_at timestamptz,
          registered_names jsonb not null default '[]'::jsonb,
          sni_codes jsonb not null default '[]'::jsonb,
          deregistration_date date,
          advertising_blocked boolean not null default false,
          ongoing_procedures jsonb not null default '[]'::jsonb
        );
        create table company_directory_scb_enrichment (
          profile_id uuid primary key,
          source_payload_hash text not null default '',
          last_synced_at timestamptz,
          provenance jsonb not null default '{}'::jsonb,
          conflicts jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        );
        create table company_directory_discovery_queue (
          profile_id uuid,
          country_code text,
          organization_number text,
          state text not null
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

    beforeEach(() => {
      for (const mock of Object.values(mocks)) mock.mockReset();
      transport.fetchCompany.mockReset();
      transport.fetchWorkplaces.mockReset();

      mocks.getSql.mockReturnValue(postgresSql(client!));
      mocks.createScbTransport.mockReturnValue(transport);
      mocks.enrichOfficialFacts.mockResolvedValue({ reusedVerifiedDetail: false });
      mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
      mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
    });

    it("selects Published safety work before Review and Inactive work even when the cursor is in Review", async () => {
      await seed("2:5562000000", [
        PROFILES.publishedLow,
        PROFILES.publishedHigh,
        PROFILES.readyLow,
        PROFILES.review,
        PROFILES.inactive,
      ]);

      const result = await revalidateAllCompanyDirectoryBatch(3);

      expect(result).toMatchObject({ selected: 3, errors: 0 });
      expect(selectedIds()).toEqual([
        PROFILES.publishedLow.id,
        PROFILES.publishedHigh.id,
        PROFILES.review.id,
      ]);
      expect(await latestCursor()).toBe("2:5562000001");
    }, 30_000);

    it("drains the Published lane across its own cursor wrap before moving to Ready", async () => {
      await seed("0:5560000005", [
        PROFILES.publishedLow,
        PROFILES.publishedHigh,
        PROFILES.readyLow,
      ]);

      const result = await revalidateAllCompanyDirectoryBatch(3);

      expect(result).toMatchObject({ selected: 3, errors: 0 });
      expect(selectedIds()).toEqual([
        PROFILES.publishedHigh.id,
        PROFILES.publishedLow.id,
        PROFILES.readyLow.id,
      ]);
      expect(await latestCursor()).toBe("1:5561000001");
    }, 30_000);

    it("preserves circular cursor ordering for non-Published recovery work", async () => {
      await seed("1:5561000005", [
        PROFILES.readyLow,
        PROFILES.readyHigh,
        PROFILES.review,
        PROFILES.inactive,
      ]);

      const result = await revalidateAllCompanyDirectoryBatch(3);

      expect(result).toMatchObject({ selected: 3, errors: 0 });
      expect(selectedIds()).toEqual([
        PROFILES.readyHigh.id,
        PROFILES.review.id,
        PROFILES.inactive.id,
      ]);
      expect(await latestCursor()).toBe("3:5563000001");
    }, 30_000);
  },
);