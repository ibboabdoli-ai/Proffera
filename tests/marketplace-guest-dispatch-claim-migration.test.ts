import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20260820_0050_marketplace_guest_dispatch_claim.sql"),
  "utf8",
);

describe("marketplace guest provider dispatch claim migration", () => {
  it("keeps an explicit atomic boundary", () => {
    expect(migration).toMatch(/^\s*begin\s*;/im);
    expect(migration).toMatch(/^\s*commit\s*;/im);
  });

  it("serializes both the pre-dispatch and provider-claimed states with opt-out", () => {
    expect(migration).toContain("new.status not in ('sending', 'pending')");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("marketplace_outreach_suppressions");
    expect(migration).toContain("marketplace_recipient_suppressed");
  });

  it("continues to fail closed when the quote or consent is no longer valid", () => {
    expect(migration).toContain("marketplace_quote_closed");
    expect(migration).toContain("marketplace_consent_required");
  });
});
