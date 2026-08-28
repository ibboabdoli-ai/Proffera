import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  waitForBolagsverketRequestSlot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/bolagsverket-api-policy", () => ({
  isBolagsverketJuridicalOrganizationNumber: () => true,
  requireBolagsverketHttpsUrl: (value: string) => new URL(value),
  waitForBolagsverketRequestSlot: mocks.waitForBolagsverketRequestSlot,
}));

import { enrichCompanyDirectoryOfficialFacts } from "../src/lib/company-directory-official-facts";

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
  "Official Facts legacy reklamspärr repair cooldown PostgreSQL integration",
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
      id: string;
      organizationNumber: string;
      ageMinutes: number;
      producer?: string;
      failed?: boolean;
    }) {
      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, country_code, last_synced_at
        ) values ($1::uuid, $2, 'SE', now() - interval '2 hours')
      `, [input.id, input.organizationNumber]);

      await client!.query(`
        insert into company_directory_official_facts (
          profile_id, advertising_blocked, data_producers, last_synced_at, updated_at
        ) values (
          $1::uuid, null, jsonb_build_object('postadressOrganisation', $2::text),
          now() - make_interval(mins => $3), now() - make_interval(mins => $3)
        )
      `, [input.id, input.producer ?? "Bolagsverket", input.ageMinutes]);

      if (input.failed) {
        await client!.query(`
          insert into company_directory_discovery_queue (
            profile_id, country_code, organization_number, state
          ) values ($1::uuid, 'SE', $2, 'failed')
        `, [input.id, input.organizationNumber]);
      }
    }

    beforeAll(async () => {
      containerName = `proffera-official-facts-cooldown-${process.pid}-${Date.now()}`;
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
        create table company_directory_profiles (
          id uuid primary key,
          organization_number text not null,
          country_code text not null,
          last_synced_at timestamptz not null
        );
        create table company_directory_official_facts (
          profile_id uuid primary key,
          advertising_blocked boolean,
          data_producers jsonb not null default '{}'::jsonb,
          last_synced_at timestamptz not null,
          updated_at timestamptz not null
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

    beforeEach(async () => {
      mocks.getSql.mockReset();
      mocks.waitForBolagsverketRequestSlot.mockReset();
      mocks.waitForBolagsverketRequestSlot.mockResolvedValue(undefined);
      mocks.getSql.mockReturnValue(postgresSql(client!));

      process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN = "integration-test-token";
      process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://example.test/organization/{organizationNumber}";
      process.env.COMPANY_DIRECTORY_DETAIL_METHOD = "GET";

      await client!.query(`
        truncate table company_directory_discovery_queue,
          company_directory_official_facts,
          company_directory_profiles
      `);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN;
      delete process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE;
      delete process.env.COMPANY_DIRECTORY_DETAIL_METHOD;
    });

    it("selects only eligible legacy rows, orders oldest first, excludes failed queue rows, and cools failed provider attempts for one hour", async () => {
      const oldest = {
        id: "20000000-0000-4000-8000-000000000001",
        organizationNumber: "5560000001",
      };
      const eligible = {
        id: "20000000-0000-4000-8000-000000000002",
        organizationNumber: "5560000002",
      };
      const cooling = {
        id: "20000000-0000-4000-8000-000000000003",
        organizationNumber: "5560000003",
      };
      const failed = {
        id: "20000000-0000-4000-8000-000000000004",
        organizationNumber: "5560000004",
      };

      await seedProfile({ ...oldest, ageMinutes: 90, producer: "bOlAgSvErKeT" });
      await seedProfile({ ...eligible, ageMinutes: 61 });
      await seedProfile({ ...cooling, ageMinutes: 59 });
      await seedProfile({ ...failed, ageMinutes: 120, failed: true });

      const fetchMock = vi.fn().mockRejectedValue(new Error("provider unavailable"));
      vi.stubGlobal("fetch", fetchMock);

      const first = await enrichCompanyDirectoryOfficialFacts(10);

      expect(first).toMatchObject({ selected: 2, processed: 0, errors: 2 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain(oldest.organizationNumber);
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain(eligible.organizationNumber);

      const attempts = await client!.query<{
        organization_number: string;
        attempted_after_sync: boolean;
      }>(`
        select profile.organization_number,
          facts.updated_at > facts.last_synced_at as attempted_after_sync
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.organization_number in ($1, $2, $3, $4)
        order by profile.organization_number
      `, [
        oldest.organizationNumber,
        eligible.organizationNumber,
        cooling.organizationNumber,
        failed.organizationNumber,
      ]);
      expect(attempts.rows).toEqual([
        { organization_number: oldest.organizationNumber, attempted_after_sync: true },
        { organization_number: eligible.organizationNumber, attempted_after_sync: true },
        { organization_number: cooling.organizationNumber, attempted_after_sync: false },
        { organization_number: failed.organizationNumber, attempted_after_sync: false },
      ]);

      fetchMock.mockClear();
      const second = await enrichCompanyDirectoryOfficialFacts(10);

      expect(second).toMatchObject({ selected: 0, processed: 0, errors: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    }, 30_000);
  },
);
