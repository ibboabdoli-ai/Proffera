import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory claim account email gate", () => {
  it("lets a logged-in account verify a business email without relying on Better Auth emailVerified", () => {
    const send = source("src/app/api/public-directory/claim-email/send/route.ts");
    const verify = source("src/app/api/public-directory/claim-email/verify/route.ts");

    expect(send).toContain("getServerSession");
    expect(send).toContain("validBusinessEmail(accountEmail)");
    expect(send).not.toContain("!account?.emailVerified");
    expect(send).toContain("sendClaimBusinessEmailCode");

    expect(verify).toContain("claim.claimant_user_id = ${userId}");
    expect(verify).toContain("evidence.accountEmail !== accountEmail");
    expect(verify).not.toContain("!row.account_email_verified");
    expect(verify).toContain("checkClaimEmailCode");
  });

  it("keeps the normal claim approval surface behind manual admin review", () => {
    const admin = source("src/lib/company-directory-claims-admin.ts");
    const adminPage = source("src/app/admin/foretag/claims/page.tsx");

    expect(admin).toContain("isClaimBusinessEmailVerified(emailEvidence)");
    expect(admin).toContain("Verification evidence/reference is required");
    expect(admin).not.toContain("Claimant email must be verified before approval");
    expect(adminPage).toContain("disabled={reservationActive}");
    expect(adminPage).not.toContain("disabled={!accountVerified || reservationActive}");
    expect(adminPage).toContain("manuella behörighetskontrollen");
  });
});
