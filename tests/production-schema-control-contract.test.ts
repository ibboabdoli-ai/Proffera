import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { REQUIRED_PRODUCTION_MIGRATIONS } from "@/lib/production-schema-health";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function controlledMigrations() {
  return readdirSync(resolve(process.cwd(), "db/migrations"))
    .map((filename) => ({
      filename,
      key: filename.match(/^(\d{8}_\d{4})_.*\.sql$/)?.[1] ?? null,
    }))
    .filter((item): item is { filename: string; key: string } => Boolean(
      item.key && item.key >= "20260823_0065",
    ))
    .sort((left, right) => left.key.localeCompare(right.key));
}

type BaseHealthMode =
  | "success"
  | "failure"
  | "missing"
  | "bootstrap404"
  | "lookup401";

function runBaseHealth(mode: BaseHealthMode) {
  const bin = mkdtempSync(resolve(tmpdir(), "proffera-base-health-"));
  const gh = resolve(bin, "gh");
  const payload = mode === "missing"
    ? '{"workflow_runs":[]}'
    : JSON.stringify({
      workflow_runs: [{
        status: "completed",
        conclusion: mode === "success" ? "success" : "failure",
        created_at: "2026-08-24T00:00:00Z",
      }],
    });

  writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"/contents/.github/workflows/"* ]]; then
  if [ "${mode}" = "bootstrap404" ]; then
    printf '%s\n' 'gh: Not Found (HTTP 404)' >&2
    exit 1
  fi
  if [ "${mode}" = "lookup401" ]; then
    printf '%s\n' 'gh: Unauthorized (HTTP 401)' >&2
    exit 1
  fi
  printf '{}\n'
  exit 0
fi
printf '%s\n' '${payload}'
`);
  chmodSync(gh, 0o755);

  try {
    return spawnSync("bash", [resolve(process.cwd(), "scripts/production-base-health.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        REPOSITORY: "ibboabdoli-ai/Proffera",
        BASE_SHA: "1111111111111111111111111111111111111111",
        HEALTH_WORKFLOW: "production-health.yml",
        BASE_HEALTH_ATTEMPTS: "1",
        BASE_HEALTH_SLEEP_SECONDS: "0",
      },
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

describe("Production schema control plane", () => {
  it("keeps the migration ledger additive, atomic and limited to verified bootstrap migrations", () => {
    const migration = source("db/migrations/20260823_0066_production_schema_ledger.sql").toLowerCase();

    expect(migration).toContain("begin;");
    expect(migration).toContain("commit;");
    expect(migration).toContain("create table if not exists proffera_schema_migrations");
    expect(migration).toContain("migration_key text primary key");
    expect(migration).toContain("'20260823_0065'");
    expect(migration).toContain("'20260823_0066'");
    expect(migration).toContain("bootstrap-verified");
    expect(migration).toContain("recovery");
    expect(migration).not.toMatch(/\bdrop\s+(table|column|schema)\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
  });

  it("forces every migration from the schema-control baseline forward into the health contract", () => {
    const migrationKeys = controlledMigrations().map((item) => item.key);

    expect([...REQUIRED_PRODUCTION_MIGRATIONS].sort()).toEqual(migrationKeys);
  });

  it("requires every post-ledger migration to record its own durable ledger entry", () => {
    for (const migration of controlledMigrations().filter((item) => item.key >= "20260823_0066")) {
      const sql = source(`db/migrations/${migration.filename}`).toLowerCase();
      expect(sql, migration.filename).toContain("insert into proffera_schema_migrations");
      expect(sql, migration.filename).toContain(`'${migration.key}'`);
    }
  });

  it("requires exact deployed-sha and authenticated schema health after main pushes", () => {
    const workflow = source(".github/workflows/production-health.yml");

    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("group: proffera-production-health-${{ github.event_name }}");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain("/api/cron/production-health");
    expect(workflow).toContain('deployed_sha" != "$TARGET_SHA');
    expect(workflow).toContain('"$ok" = "true"');
    expect(workflow).toContain('"$environment" = "production"');
    expect(workflow).toContain("timeout-minutes: 8");
  });

  it("runs the PR base gate only from the trusted base commit", () => {
    const workflow = source(".github/workflows/production-base-health.yml");
    const script = source("scripts/production-base-health.sh");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("BASE_SHA: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("path: trusted-base");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain('trusted_script="trusted-base/scripts/production-base-health.sh"');
    expect(workflow).toContain('bash "$trusted_script"');
    expect(script).toContain("head_sha=$BASE_SHA");
    expect(script).toContain("New work is blocked");
  });

  it("executes exact-base health success and failure paths", () => {
    const success = runBaseHealth("success");
    const failure = runBaseHealth("failure");
    const missing = runBaseHealth("missing");

    expect(success.status, success.stderr).toBe(0);
    expect(success.stdout).toContain("Production is healthy on exact PR base");
    expect(failure.status).not.toBe(0);
    expect(failure.stdout).toContain("New work is blocked");
    expect(missing.status).not.toBe(0);
    expect(missing.stdout).toContain("No successful Production health result became available");
  });

  it("allows bootstrap only for an explicit 404 and fails closed on lookup errors", () => {
    const bootstrap = runBaseHealth("bootstrap404");
    const unauthorized = runBaseHealth("lookup401");

    expect(bootstrap.status, bootstrap.stderr).toBe(0);
    expect(bootstrap.stdout).toContain("allowing bootstrap PR only");
    expect(unauthorized.status).not.toBe(0);
    expect(unauthorized.stderr).toContain("HTTP 401");
    expect(unauthorized.stderr).toContain("Could not verify Production health workflow");
  });
});
