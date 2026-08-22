import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const accessMigration = fs.readFileSync(
  path.join(process.cwd(), "db/migrations/20260822_0060_marketplace_customer_comparison.sql"),
  "utf8",
);
const winnerIndexMigration = fs.readFileSync(
  path.join(process.cwd(), "db/migrations/20260822_0062_marketplace_single_winner_index.sql"),
  "utf8",
);

describe("marketplace customer comparison migrations", () => {
  it("stores only hashed customer access tokens with a bounded state machine", () => {
    expect(accessMigration).toContain("create table if not exists marketplace_quote_customer_access");
    expect(accessMigration).toContain("token_hash text not null unique");
    expect(accessMigration).toContain("check (char_length(token_hash) = 64)");
    expect(accessMigration).toContain("status in ('sending', 'sent', 'delivery_failed')");
    expect(accessMigration).not.toMatch(/\braw_token\b/i);
    expect(accessMigration).not.toContain("marketplace_quote_offers_one_selected_per_quote_idx");
  });

  it("creates the single-winner guard concurrently after an explicit duplicate pre-check", () => {
    expect(winnerIndexMigration).toContain("HAVING count(*) > 1");
    expect(winnerIndexMigration).toContain("RAISE EXCEPTION");
    expect(winnerIndexMigration).toContain("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS marketplace_quote_offers_one_selected_per_quote_idx");
    expect(winnerIndexMigration).toContain("ON marketplace_quote_offers (quote_request_id)");
    expect(winnerIndexMigration).toContain("WHERE status = 'selected'");
    expect(winnerIndexMigration).toContain("DROP INDEX CONCURRENTLY IF EXISTS marketplace_quote_offers_one_selected_per_quote_idx");
    expect(winnerIndexMigration).not.toMatch(/^\s*begin\s*;/im);
    expect(winnerIndexMigration).not.toMatch(/^\s*commit\s*;/im);
  });
});
