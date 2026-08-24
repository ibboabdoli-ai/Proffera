import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";

type PendingQuery = {
  text: string;
  values: unknown[];
};

type QueryBarrier = {
  wait: () => Promise<void>;
  abort: (error: unknown) => void;
  arrivals: () => number;
};

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));

import {
  createOwnerBusinessProfileLocation,
  deactivateOwnerBusinessProfileLocation,
} from "../src/lib/business-profile-location-owner";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function taggedQuery(strings: TemplateStringsArray, values: unknown[]): PendingQuery {
  let text = "";
  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index] ?? "";
    if (index < values.length) text += `$${index + 1}`;
  }
  return { text, values };
}

function createQueryBarrier(parties = 2, timeoutMs = 5_000): QueryBarrier {
  let arrived = 0;
  let settled = false;
  let failure: Error | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let release!: () => void;
  let reject!: (error: Error) => void;
  const released = new Promise<void>((resolve, rejectPromise) => {
    release = resolve;
    reject = rejectPromise;
  });

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const abort = (error: unknown) => {
    if (settled) return;
    failure = error instanceof Error ? error : new Error(String(error ?? "Query barrier aborted"));
    settled = true;
    clearTimer();
    reject(failure);
  };

  return {
    async wait() {
      if (failure) throw failure;
      if (settled) return;

      arrived += 1;
      if (arrived === 1) {
        timer = setTimeout(() => {
          abort(new Error(`Query barrier timed out after ${timeoutMs}ms waiting for ${parties} participants`));
        }, timeoutMs);
      }
      if (arrived >= parties) {
        settled = true;
        clearTimer();
        release();
      }
      await released;
    },
    abort,
    arrivals: () => arrived,
  };
}

function createPostgresSqlAdapter(
  connectionString: string,
  options: { profileLockBarrier?: QueryBarrier } = {},
) {
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => taggedQuery(strings, values)) as unknown as {
    (strings: TemplateStringsArray, ...values: unknown[]): PendingQuery;
    transaction: (queries: PendingQuery[]) => Promise<Record<string, unknown>[][]>;
  };

  sql.transaction = async (queries) => {
    const transactionClient = new Client({ connectionString });
    await transactionClient.connect();
    try {
      await transactionClient.query("begin");
      const results: Record<string, unknown>[][] = [];
      for (let index = 0; index < queries.length; index += 1) {
        const query = queries[index]!;
        if (
          index === 0
          && query.text.includes("from company_directory_profiles profile")
          && /\bfor\s+update\b/iu.test(query.text)
          && options.profileLockBarrier
        ) {
          await options.profileLockBarrier.wait();
        }
        const result = await transactionClient.query(query.text, query.values);
        results.push(result.rows as Record<string, unknown>[]);
      }
      await transactionClient.query("commit");
      return results;
    } catch (error) {
      options.profileLockBarrier?.abort(error);
      await transactionClient.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      await transactionClient.end().catch(() => undefined);
    }
  };

  return sql;
}

function primaryLocationInput(purpose: "storefront" | "service_base") {
  return {
    purpose,
    visibility: "private" as const,
    isVisitable: true,
    isPrimary: true,
    confirmed: false,
    addressLine1: purpose === "storefront" ? "Storgatan 1" : "Industrivägen 2",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    latitude: 59.1955,
    longitude: 17.6253,
    geocodeSource: "owner",
    geocodePrecision: "address" as const,
  };
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Business Profile owner-location PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client;

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
      containerName = `proffera-owner-location-${process.pid}-${Date.now()}`;
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
          id uuid primary key,
          claimed_workspace_id uuid references workspaces(id),
          publication_status text not null default 'draft',
          is_active boolean not null default true,
          privacy_blocked boolean not null default false
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
    }, 120_000);

    beforeEach(async () => {
      await client.query("truncate table company_directory_profile_locations, company_directory_profiles, workspaces cascade");
      await client.query("insert into workspaces (id) values ($1)", [WORKSPACE_ID]);
      await client.query(`
        insert into company_directory_profiles (
          id, claimed_workspace_id, publication_status, is_active, privacy_blocked
        ) values ($1, $2, 'claimed', true, false)
      `, [PROFILE_ID, WORKSPACE_ID]);

      mocks.getUserWorkspaceAccess.mockReset();
      mocks.canManageWorkspaceSettings.mockReset();
      mocks.getSql.mockReset();
      mocks.getUserWorkspaceAccess.mockResolvedValue({
        ok: true,
        userId: "user-1",
        workspaceId: WORKSPACE_ID,
        workspaceSlug: "owner-company",
        workspaceName: "Owner Company",
        workspaceStatus: "active",
        role: "owner",
      });
      mocks.canManageWorkspaceSettings.mockReturnValue(true);
      mocks.getSql.mockReturnValue(createPostgresSqlAdapter(connectionString));
    });

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

    it("fails a waiting query barrier instead of hanging when another participant aborts", async () => {
      const barrier = createQueryBarrier(2, 100);
      const waiting = barrier.wait();
      barrier.abort(new Error("participant failed before reaching the profile lock"));

      await expect(waiting).rejects.toThrow("participant failed before reaching the profile lock");
      await expect(barrier.wait()).rejects.toThrow("participant failed before reaching the profile lock");
      expect(barrier.arrivals()).toBe(1);
    });

    it("serializes concurrent primary creates so exactly one active primary remains", async () => {
      const barrier = createQueryBarrier();
      mocks.getSql.mockReturnValue(createPostgresSqlAdapter(connectionString, { profileLockBarrier: barrier }));

      const [first, second] = await Promise.all([
        createOwnerBusinessProfileLocation(primaryLocationInput("storefront")),
        createOwnerBusinessProfileLocation(primaryLocationInput("service_base")),
      ]);

      expect(barrier.arrivals()).toBe(2);
      expect(first.id).not.toBe(second.id);

      const rows = await client.query<{
        id: string;
        purpose: string;
        is_primary: boolean;
        owner_workspace_id: string;
      }>(`
        select id::text, purpose, is_primary, owner_workspace_id::text
        from company_directory_profile_locations
        where profile_id = $1
          and source_type = 'owner'
          and is_active = true
        order by created_at, id
      `, [PROFILE_ID]);

      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.every((row) => row.owner_workspace_id === WORKSPACE_ID)).toBe(true);
      expect(rows.rows.filter((row) => row.is_primary)).toHaveLength(1);
    });

    it("serializes deactivation against a concurrent primary create", async () => {
      const existing = await createOwnerBusinessProfileLocation(primaryLocationInput("storefront"));
      const barrier = createQueryBarrier();
      mocks.getSql.mockReturnValue(createPostgresSqlAdapter(connectionString, { profileLockBarrier: barrier }));

      const [, replacement] = await Promise.all([
        deactivateOwnerBusinessProfileLocation(existing.id),
        createOwnerBusinessProfileLocation(primaryLocationInput("service_base")),
      ]);

      expect(barrier.arrivals()).toBe(2);

      const oldRow = await client.query<{
        is_active: boolean;
        is_primary: boolean;
        visibility: string;
      }>(`
        select is_active, is_primary, visibility
        from company_directory_profile_locations
        where id = $1
      `, [existing.id]);
      expect(oldRow.rows[0]).toEqual({
        is_active: false,
        is_primary: false,
        visibility: "private",
      });

      const activeRows = await client.query<{
        id: string;
        is_primary: boolean;
        owner_workspace_id: string;
      }>(`
        select id::text, is_primary, owner_workspace_id::text
        from company_directory_profile_locations
        where profile_id = $1
          and source_type = 'owner'
          and is_active = true
        order by created_at, id
      `, [PROFILE_ID]);

      expect(activeRows.rows).toHaveLength(1);
      expect(activeRows.rows[0]).toEqual({
        id: replacement.id,
        is_primary: true,
        owner_workspace_id: WORKSPACE_ID,
      });
    });
  },
);