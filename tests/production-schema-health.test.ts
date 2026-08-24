import { describe, expect, it, vi } from "vitest";

import {
  inspectProductionSchema,
  REQUIRED_PRODUCTION_MIGRATIONS,
} from "@/lib/production-schema-health";

function contractRows(overrides: Partial<{
  column_present: boolean;
  foreign_key_validated: boolean;
  index_present: boolean;
  ledger_present: boolean;
}> = {}) {
  return [{
    column_present: true,
    foreign_key_validated: true,
    index_present: true,
    ledger_present: true,
    ...overrides,
  }];
}

describe("Production schema health", () => {
  it("passes only when the complete schema contract and migration ledger are present", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: contractRows() })
      .mockResolvedValueOnce({
        rows: REQUIRED_PRODUCTION_MIGRATIONS.map((migration_key) => ({ migration_key })),
      });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(true);
    expect(result.databaseReachable).toBe(true);
    expect(result.missingMigrations).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);

    const contractSql = String(query.mock.calls[0]?.[0] ?? "");
    expect(contractSql).toContain("constraint_meta.conrelid = to_regclass('public.workspace_services')");
    expect(contractSql).toContain("constraint_meta.confrelid = to_regclass('public.company_directory_services')");
    expect(contractSql).toContain("constraint_meta.contype = 'f'");
    expect(contractSql).toContain("constraint_meta.confdeltype = 'r'");
    expect(contractSql).toContain("attribute.attname = 'primary_directory_service_slug'");
    expect(contractSql).toContain("attribute.attname = 'slug'");
    expect(contractSql).toContain("index_meta.indrelid = to_regclass('public.workspace_services')");
    expect(contractSql).toContain("index_meta.indnkeyatts = 2");
    expect(contractSql).toContain("access_method.amname = 'btree'");
    expect(contractSql).toContain("pg_get_indexdef(index_meta.indexrelid, 1, true) = 'workspace_id'");
    expect(contractSql).toContain("pg_get_indexdef(index_meta.indexrelid, 2, true) = 'primary_directory_service_slug'");
    expect(contractSql).toContain("pg_get_expr(index_meta.indpred, index_meta.indrelid)");
    expect(contractSql).toContain("primary_directory_service_slugisnotnull");
  });

  it("fails closed when the ledger is missing and does not query a missing table", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: contractRows({ ledger_present: false }),
    });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(false);
    expect(result.ledgerPresent).toBe(false);
    expect(result.missingMigrations).toEqual([...REQUIRED_PRODUCTION_MIGRATIONS]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong foreign-key definition", { foreign_key_validated: false }, "foreignKeyValidated"],
    ["wrong index definition", { index_present: false }, "indexPresent"],
    ["missing service identity column", { column_present: false }, "columnPresent"],
  ] as const)("fails closed for %s", async (_name, override, field) => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: contractRows(override) })
      .mockResolvedValueOnce({
        rows: REQUIRED_PRODUCTION_MIGRATIONS.map((migration_key) => ({ migration_key })),
      });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(false);
    expect(result.workspaceServiceIdentity[field]).toBe(false);
  });

  it("fails closed when a required migration is missing", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: contractRows() })
      .mockResolvedValueOnce({ rows: [{ migration_key: "20260823_0065" }] });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(false);
    expect(result.missingMigrations).toEqual(["20260823_0066"]);
  });
});
