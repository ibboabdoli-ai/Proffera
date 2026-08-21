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

  it("adds durable ownership for each provider dispatch attempt", () => {
    expect(migration).toContain("add column if not exists dispatch_token uuid");
    expect(migration).toContain("marketplace_dispatch_token_required");
  });

  it("serializes both the pre-dispatch and provider-claimed states with opt-out", () => {
    expect(migration).toContain("new.status not in ('sending', 'pending')");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toMatch(/pg_advisory_xact_lock\(\s*hashtextextended\(normalized_email,\s*0\)\s*\)/);
    expect(migration).toMatch(/from quote_requests[\s\S]*for update/i);
    expect(migration).toContain("marketplace_outreach_suppressions");
    expect(migration).toContain("marketplace_recipient_suppressed");
  });

  it("continues to fail closed when the quote or consent is no longer valid", () => {
    expect(migration).toContain("marketplace_quote_closed");
    expect(migration).toContain("marketplace_consent_required");
  });
});
