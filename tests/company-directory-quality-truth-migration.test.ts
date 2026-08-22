import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const FOUNDATION = "db/migrations/20260809_0037_company_profile_engine_foundation.sql";
// 0060 is intentionally not loaded here: it belongs to the independent
// Marketplace customer-comparison chain. This contract isolates the Directory
// quality correction that follows it as migration 0061.
const QUALITY_MIGRATION = "db/migrations/20260822_0061_company_directory_quality_truth.sql";

/** Run a Docker CLI command and return trimmed stdout for PostgreSQL test setup. */
function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Company Directory quality truth PostgreSQL contract",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

    /** Wait until the isolated PostgreSQL test container accepts connections. */
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
      containerName = `proffera-directory-quality-${process.pid}-${Date.now()}`;
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
      await client.query(readFileSync(join(process.cwd(), FOUNDATION), "utf8"));
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

    it("removes only the legacy unavailable-tax award and is idempotent", async () => {
      const fixedUpdatedAt = "2026-08-22T12:00:00.000Z";
      const claimedWorkspaceId = "00000000-0000-0000-0000-000000000001";
      await client!.query("insert into workspaces (id) values ($1)", [claimedWorkspaceId]);
      await client!.query(`
        insert into company_directory_profiles (
          organization_number, organization_kind, legal_name, display_name, public_slug,
          publication_status, is_active, auto_public_eligible, quality_score,
          city, category_slug, f_tax_status, vat_status, employer_status,
          claimed_workspace_id, updated_at
        ) values
          ('5560000001', 'juridical_person', 'Published AB', 'Published AB', 'published-ab',
           'published', true, true, 100, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000002', 'juridical_person', 'Review AB', 'Review AB', 'review-ab',
           'review', true, false, 95, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000003', 'juridical_person', 'Tax Verified AB', 'Tax Verified AB', 'tax-verified-ab',
           'ready', true, true, 100, 'Stockholm', 'stadning', 'Registrerad', '', '', null, $1),
          ('5560000004', 'juridical_person', 'Inactive AB', 'Inactive AB', 'inactive-ab',
           'inactive', false, false, 70, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000005', 'juridical_person', 'Boundary Published AB', 'Boundary Published AB', 'boundary-published-ab',
           'published', true, true, 80, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000006', 'juridical_person', 'Guard Edge AB', 'Guard Edge AB', 'guard-edge-ab',
           'published', true, true, 85, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000007', 'juridical_person', 'Zero Score AB', 'Zero Score AB', 'zero-score-ab',
           'ready', true, true, 0, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000008', 'juridical_person', 'Claimed Workspace AB', 'Claimed Workspace AB', 'claimed-workspace-ab',
           'claimed', true, false, 100, 'Stockholm', 'stadning', '', '', '', $2, $1),
          ('5560000009', 'juridical_person', 'Claimed Status AB', 'Claimed Status AB', 'claimed-status-ab',
           'claimed', true, false, 95, 'Stockholm', 'stadning', '', '', '', null, $1),
          ('5560000010', 'juridical_person', 'Workspace Owned Review AB', 'Workspace Owned Review AB', 'workspace-owned-review-ab',
           'review', true, false, 95, 'Stockholm', 'stadning', '', '', '', $2, $1)
      `, [fixedUpdatedAt, claimedWorkspaceId]);

      const migration = readFileSync(join(process.cwd(), QUALITY_MIGRATION), "utf8");
      await expect(client!.query(migration)).resolves.toBeDefined();
      await expect(client!.query(migration)).resolves.toBeDefined();

      const rows = await client!.query<{
        organization_number: string;
        publication_status: string;
        quality_score: number;
        quality_reasons: string[];
        updated_at: string;
      }>(`
        select organization_number, publication_status, quality_score,
               quality_reasons, updated_at::text
        from company_directory_profiles
        order by organization_number
      `);

      expect(rows.rows).toEqual([
        expect.objectContaining({
          organization_number: "5560000001",
          publication_status: "published",
          quality_score: 95,
          quality_reasons: ["tax_status_unavailable_from_source"],
        }),
        expect.objectContaining({
          organization_number: "5560000002",
          publication_status: "review",
          quality_score: 90,
          quality_reasons: ["tax_status_unavailable_from_source"],
        }),
        expect.objectContaining({
          organization_number: "5560000003",
          publication_status: "ready",
          quality_score: 100,
          quality_reasons: [],
        }),
        expect.objectContaining({
          organization_number: "5560000004",
          publication_status: "inactive",
          quality_score: 70,
          quality_reasons: [],
        }),
        expect.objectContaining({
          organization_number: "5560000005",
          publication_status: "review",
          quality_score: 75,
          quality_reasons: ["tax_status_unavailable_from_source"],
        }),
        expect.objectContaining({
          organization_number: "5560000006",
          publication_status: "published",
          quality_score: 80,
          quality_reasons: ["tax_status_unavailable_from_source"],
        }),
        expect.objectContaining({
          organization_number: "5560000007",
          publication_status: "ready",
          quality_score: 0,
          quality_reasons: ["tax_status_unavailable_from_source"],
        }),
        expect.objectContaining({
          organization_number: "5560000008",
          publication_status: "claimed",
          quality_score: 100,
          quality_reasons: [],
        }),
        expect.objectContaining({
          organization_number: "5560000009",
          publication_status: "claimed",
          quality_score: 95,
          quality_reasons: [],
        }),
        expect.objectContaining({
          organization_number: "5560000010",
          publication_status: "review",
          quality_score: 95,
          quality_reasons: [],
        }),
      ]);

      expect(rows.rows.every((row) => new Date(row.updated_at).toISOString() === fixedUpdatedAt)).toBe(true);
    }, 30_000);
  },
);
