import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scripts = [
  "20261103_0072_maria_manual_closed_starts.sql",
  "20261105_0073_public_booking_verification_contact_fields.sql",
];

describe("Maria Preview schema release boundary", () => {
  it("keeps unapplied QA migrations outside the controlled Production ledger", () => {
    for (const filename of scripts) {
      const production = resolve(root, "db/migrations", filename);
      const qaOnly = resolve(root, "db/preview-migrations", filename);
      expect(existsSync(production)).toBe(false);
      expect(existsSync(qaOnly)).toBe(true);
      const sql = readFileSync(qaOnly, "utf8");
      expect(sql).toContain("Not a Production-ledger migration");
    }
  });

  it("requires explicit opt-in from synthetic Maria PostgreSQL fixtures", () => {
    const helper = readFileSync(resolve(root, "tests/helpers/postgres-canonical-schema.ts"), "utf8");
    expect(helper).toContain("export async function applyMariaPreviewMigrations");
    expect(helper).toContain('await client.query("ROLLBACK")');
    expect(helper).toContain('await client.query("RESET lock_timeout")');
    expect(helper).toContain('await client.query("RESET statement_timeout")');
    for (const filename of scripts) expect(helper).toContain(filename);
  });
});
