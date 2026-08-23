import { describe, expect, it, vi } from "vitest";

import {
  inspectProductionSchema,
  REQUIRED_PRODUCTION_MIGRATIONS,
} from "@/lib/production-schema-health";

describe("Production schema health", () => {
  it("passes only when the critical schema contract and migration ledger are complete", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          column_present: true,
          foreign_key_validated: true,
          index_present: true,
          ledger_present: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: REQUIRED_PRODUCTION_MIGRATIONS.map((migration_key) => ({ migration_key })),
      });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(true);
    expect(result.databaseReachable).toBe(true);
    expect(result.missingMigrations).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the ledger is missing and does not query a missing table", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{
        column_present: true,
        foreign_key_validated: true,
        index_present: true,
        ledger_present: false,
      }],
    });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(false);
    expect(result.ledgerPresent).toBe(false);
    expect(result.missingMigrations).toEqual([...REQUIRED_PRODUCTION_MIGRATIONS]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("fails closed for a partial schema contract or missing required migration", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          column_present: true,
          foreign_key_validated: false,
          index_present: true,
          ledger_present: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ migration_key: "20260823_0065" }] });

    const result = await inspectProductionSchema(query);

    expect(result.ok).toBe(false);
    expect(result.workspaceServiceIdentity.foreignKeyValidated).toBe(false);
    expect(result.missingMigrations).toEqual(["20260823_0066"]);
  });
});
