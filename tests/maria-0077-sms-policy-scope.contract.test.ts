import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file = readFileSync("db/migrations/20261111_0077_workspace_starter_sms_quota.sql", "utf8");
describe("Migration 0077 Maria-only Starter SMS policy hardening", () => {
  it("does not globally change the SMS minimum plan for other tenants", () => {
    expect(file).not.toMatch(/\bUPDATE\s+feature_catalog\s+SET\s+minimum_plan/iu);
  });
  it("guards legacy CHECK removal behind validated catalog foreign key", () => {
    expect(file).toContain("conname = 'workspace_feature_flags_feature_catalog_fkey'");
    expect(file).toContain("AND contype = 'f' AND convalidated");
    expect(file).toContain("AND conkey = ARRAY[");
    expect(file).toContain("AND confkey = ARRAY[");
    expect(file).toContain("AND attname='feature_key' AND NOT attisdropped");
    expect(file).toContain("RAISE EXCEPTION 'Migration 0077 requires validated catalog FK");
    expect(file).toContain("DROP CONSTRAINT workspace_feature_flags_feature_key_check");
    expect(file).not.toContain("DROP CONSTRAINT IF EXISTS workspace_feature_flags_feature_key_check");
  });
  it("requires exact Maria slug within the database quota reservation", () => {
    expect(file).toContain("workspace.slug = 'makeup-by-maria'");
    expect(file).toContain("JOIN workspace_feature_flags flag");
    expect(file).toContain("billing.sms_monthly_limit IN (50,100)");
    expect(file).toContain("FOR UPDATE OF billing");
  });
});
