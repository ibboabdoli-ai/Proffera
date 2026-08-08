import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "db", "migrations", name), "utf8").toLowerCase();

describe("database migration hardening contract", () => {
  it("keeps tenant relation migration parser-safe and complete", () => {
    const migration = readMigration("20260808_0033_tenant_relation_constraints.sql");

    expect(migration).not.toContain("do $$");
    expect(migration.match(/add constraint/g)).toHaveLength(17);
    expect(migration.match(/validate constraint/g)).toHaveLength(17);
    expect(migration.match(/create unique index if not exists/g)).toHaveLength(7);
  });

  it("archives legacy default seeds and prevents the sentinel from returning", () => {
    const migration = readMigration("20260808_0034_legacy_default_workspace_cleanup.sql");

    expect(migration).not.toContain("do $$");
    expect(migration).toContain("legacy_workspace_seed_archive");
    expect(migration).toContain("delete from workspace_services where workspace_id = 'default'");
    expect(migration).toContain("delete from workspace_settings where workspace_id = 'default'");
    expect(migration.match(/alter column workspace_id drop default/g)).toHaveLength(2);
    expect(migration.match(/workspace_id_uuid_shape_check/g)).toHaveLength(4);
    expect(migration.match(/validate constraint/g)).toHaveLength(2);
  });
});
