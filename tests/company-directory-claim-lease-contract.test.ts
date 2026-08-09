import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory claim lease contract", () => {
  it("keeps reservation id, token and timestamp paired", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/20260810_0042_company_profile_claim_reservation_lease.sql"),
      "utf8",
    );

    expect(sql).toContain("claim_reserved_at");
    expect(sql).toContain("claim_reservation_token");
    expect(sql).toContain("company_directory_profiles_claim_reservation_pair_check");
  });

  it("keeps stale recovery tokenized and workspace-safe", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-claims-admin.ts"),
      "utf8",
    );

    expect(source).toContain("CLAIM_RESERVATION_LEASE_MINUTES = 15");
    expect(source).toContain("claim_reservation_token = ${reservationToken}::uuid");
    expect(source).toContain("profile.claim_reservation_token = ${reservationToken}::uuid");
    expect(source).toContain("from workspaces workspace");
    expect(source).toContain("workspace.id = claim.requested_workspace_id");
  });
});
