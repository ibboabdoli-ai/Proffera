import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client, type QueryResultRow } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const emptyWorkspace = "33333333-3333-4333-8333-333333333333";

const migrationFiles = [
  "20260613_phase18_booking_crm.sql",
  "20260614_phase18_16_workspace_services.sql",
  "20260808_0035_customers_rls_pilot.sql",
] as const;

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function applyMigration(client: Client, file: string) {
  await client.query(readFileSync(join(process.cwd(), "db/migrations", file), "utf8"));
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Dashboard Leads PostgreSQL tenant RLS",
  () => {
    let containerName = "";
    let connectionString = "";
    let setupClient: Client | undefined;

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

    async function runAsTenant<T extends QueryResultRow>(
      workspaceId: string | null,
      text: string,
      values: unknown[] = [],
    ) {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query("begin");
        await client.query("set local role proffera_tenant_rls");
        if (workspaceId !== null) {
          await client.query("select set_config('app.workspace_id', $1, true)", [workspaceId]);
        }
        return await client.query<T>(text, values);
      } finally {
        await client.query("rollback").catch(() => undefined);
        await client.end().catch(() => undefined);
      }
    }

    beforeAll(async () => {
      containerName = `proffera-dashboard-leads-rls-${process.pid}-${Date.now()}`;
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
      if (!port) throw new Error(`Could not resolve PostgreSQL port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();

      setupClient = new Client({ connectionString });
      await setupClient.connect();
      await setupClient.query("create role neondb_owner nologin");
      for (const file of migrationFiles) await applyMigration(setupClient, file);

      await setupClient.query(`
        insert into customers (
          id, workspace_id, name, city, status, source, primary_service_slug, created_at
        ) values
          ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, 'Workspace A Lead', 'Södertälje', 'prospect', 'web_form', 'shared-service', '2026-09-13T08:00:00Z'),
          ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $2, 'Workspace B Lead', 'Stockholm', 'prospect', 'web_form', 'shared-service', '2026-09-13T09:00:00Z'),
          ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'Workspace A Customer', 'Södertälje', 'active', 'manual', 'shared-service', '2026-09-13T10:00:00Z')
      `, [workspaceA, workspaceB]);
      await setupClient.query(`
        insert into workspace_services (workspace_id, name)
        values ($1, 'Workspace A Service'), ($2, 'Workspace B Secret Service')
      `, [workspaceA, workspaceB]);
    }, 120_000);

    afterAll(async () => {
      await setupClient?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // The disposable --rm container may already have exited.
        }
      }
    });

    it("allows Workspace A to load only its own prospect Leads", async () => {
      const result = await runAsTenant<{ id: string; name: string }>(
        workspaceA,
        `select id::text, name
         from customers
         where workspace_id = $1 and status = 'prospect'
         order by created_at desc`,
        [workspaceA],
      );

      expect(result.rows).toEqual([
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Workspace A Lead" },
      ]);
    });

    it("blocks a malicious Workspace B predicate while Workspace A context is active", async () => {
      const result = await runAsTenant<{ id: string }>(
        workspaceA,
        "select id::text from customers where workspace_id = $1",
        [workspaceB],
      );

      expect(result.rows).toEqual([]);
    });

    it("does not permit service metadata to be obtained through a joined Leads query", async () => {
      await expect(runAsTenant(
        workspaceA,
        `select customer.id, service.name
         from customers customer
         left join workspace_services service
           on service.workspace_id = customer.workspace_id
         where customer.workspace_id = $1`,
        [workspaceA],
      )).rejects.toMatchObject({ code: "42501" });
    });

    it("fails closed when the transaction has no Workspace context", async () => {
      const result = await runAsTenant<{ id: string }>(
        null,
        "select id::text from customers order by created_at desc",
      );

      expect(result.rows).toEqual([]);
    });

    it("returns an ordinary empty result for a valid Workspace with no Leads", async () => {
      const result = await runAsTenant<{ id: string }>(
        emptyWorkspace,
        "select id::text from customers where workspace_id = $1 and status = 'prospect'",
        [emptyWorkspace],
      );

      expect(result.rows).toEqual([]);
    });
  },
);
