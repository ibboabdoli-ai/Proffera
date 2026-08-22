import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "db/migrations/20260822_0060_marketplace_customer_comparison.sql"),
  "utf8",
);

describe("marketplace customer comparison migration", () => {
  it("stores only hashed customer access tokens with a bounded state machine", () => {
    expect(migration).toContain("create table if not exists marketplace_quote_customer_access");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("check (char_length(token_hash) = 64)");
    expect(migration).toContain("status in ('sending', 'sent', 'delivery_failed')");
    expect(migration).not.toMatch(/\braw_token\b/i);
  });

  it("enforces exactly one selected marketplace offer per quote request", () => {
    expect(migration).toContain("create unique index if not exists marketplace_quote_offers_one_selected_per_quote_idx");
    expect(migration).toContain("on marketplace_quote_offers (quote_request_id)");
    expect(migration).toContain("where status = 'selected'");
  });
});
