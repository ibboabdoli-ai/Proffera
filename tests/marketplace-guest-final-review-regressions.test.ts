import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "db/migrations", name), "utf8");
}

const runtimeEligibility = migration("20260820_0051_marketplace_guest_runtime_eligibility.sql");
const recipientIndex = migration("20260821_0053_marketplace_guest_recipient_index.sql");
const statusValidation = migration("20260821_0054_marketplace_guest_status_validation.sql");
const baseline = readFileSync(
  join(process.cwd(), "tests/fixtures/marketplace-guest-production-baseline.sql"),
  "utf8",
);

describe("marketplace guest final review regressions", () => {
  it("validates the widened status constraint only in the later migration", () => {
    expect(runtimeEligibility).not.toMatch(
      /validate\s+constraint\s+marketplace_quote_invitations_status_check/iu,
    );
    expect(statusValidation).toMatch(
      /validate\s+constraint\s+marketplace_quote_invitations_status_check/iu,
    );
  });

  it("keeps provider claims immutable and fails closed for any stale claimed retry", () => {
    expect(runtimeEligibility).toContain("marketplace_provider_claim_immutable");
    expect(runtimeEligibility).toMatch(
      /old\.provider_claimed_at\s+is\s+not\s+null[\s\S]*new\.provider_claimed_at\s+is\s+null[\s\S]*new\.status\s*<>\s*'cancelled'/iu,
    );

    const staleClaimBlock = runtimeEligibility.match(
      /if old\.status = 'pending'[\s\S]*?return new;[\s\S]*?end if;/iu,
    )?.[0] ?? "";
    expect(staleClaimBlock).toContain("old.provider_claimed_at is not null");
    expect(staleClaimBlock).toContain("new.status = 'sending'");
    expect(staleClaimBlock).not.toContain("new.dispatch_token is distinct from old.dispatch_token");
  });

  it("verifies the concurrent normalized index before dropping the fallback", () => {
    const validityCheck = recipientIndex.indexOf("pg_index");
    const validFlag = recipientIndex.indexOf("indisvalid");
    const fallbackDrop = recipientIndex.indexOf("drop index concurrently if exists marketplace_quote_invitations_recipient_idx");

    expect(validityCheck).toBeGreaterThan(-1);
    expect(validFlag).toBeGreaterThan(validityCheck);
    expect(fallbackDrop).toBeGreaterThan(validFlag);
    expect(recipientIndex).toContain("marketplace_recipient_norm_index_invalid");
  });

  it("executes a quote_requests schema and status contract in the PostgreSQL baseline", () => {
    expect(baseline).toContain("marketplace_guest_quote_requests_schema_missing");
    expect(baseline).toContain("marketplace_guest_quote_requests_status_contract_invalid");
    expect(baseline).toMatch(/\('id'\), \('status'\), \('consent_accepted'\)/u);
    for (const status of [
      "submitted",
      "pending_review",
      "approved",
      "matched",
      "answered",
      "booked",
      "completed",
      "cancelled",
      "rejected",
    ]) {
      expect(baseline).toContain(`position('${status}' in status_definition)`);
    }
  });
});