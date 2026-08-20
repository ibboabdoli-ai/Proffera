import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20260820_0049_marketplace_guest_quotes.sql"),
  "utf8",
);

describe("marketplace guest invitation wave cap migration", () => {
  it("does not nest its own transaction wrapper", () => {
    expect(migration).not.toMatch(/^\s*begin\s*;/im);
    expect(migration).not.toMatch(/^\s*commit\s*;/im);
  });

  it("only permits the two marketplace waves", () => {
    expect(migration).toContain("check (wave in (1, 2))");
    expect(migration).toContain("marketplace_invalid_wave");
  });

  it("serializes and enforces the 3+2 and total-five caps in PostgreSQL", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("when 1 then 3 when 2 then 2");
    expect(migration).toContain("wave_count >= wave_limit");
    expect(migration).toContain("total_count >= 5");
    expect(migration).toContain("marketplace_wave_limit");
  });
});
