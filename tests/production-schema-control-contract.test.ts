import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REQUIRED_PRODUCTION_MIGRATIONS } from "@/lib/production-schema-health";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Production schema control plane", () => {
  it("keeps the migration ledger additive and bootstraps only independently verified migrations", () => {
    const migration = source("db/migrations/20260823_0066_production_schema_ledger.sql").toLowerCase();

    expect(migration).toContain("create table if not exists proffera_schema_migrations");
    expect(migration).toContain("migration_key text primary key");
    expect(migration).toContain("'20260823_0065'");
    expect(migration).toContain("'20260823_0066'");
    expect(migration).toContain("bootstrap-verified");
    expect(migration).not.toMatch(/\bdrop\s+(table|column|schema)\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
  });

  it("forces every migration from the schema-control baseline forward into the health contract", () => {
    const migrationKeys = readdirSync(resolve(process.cwd(), "db/migrations"))
      .map((filename) => filename.match(/^(\d{8}_\d{4})_.*\.sql$/)?.[1] ?? null)
      .filter((key): key is string => Boolean(key && key >= "20260823_0065"))
      .sort();

    expect([...REQUIRED_PRODUCTION_MIGRATIONS].sort()).toEqual(migrationKeys);
  });

  it("requires exact deployed-sha and authenticated schema health after main pushes", () => {
    const workflow = source(".github/workflows/production-health.yml");

    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain("/api/cron/production-health");
    expect(workflow).toContain('deployed_sha" != "$TARGET_SHA');
    expect(workflow).toContain('"$ok" = "true"');
    expect(workflow).toContain('"$environment" = "production"');
    expect(workflow).toContain("timeout-minutes: 8");
  });
});
