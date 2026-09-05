import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory claim email concurrency guards", () => {
  it("compare-and-swaps the exact verification evidence before every verify mutation", () => {
    const verify = source("src/app/api/public-directory/claim-email/verify/route.ts");

    expect(verify).toContain("const MAX_STALE_EVIDENCE_REEVALUATIONS = 5");
    expect(verify).toContain("const originalVerificationReference = String(row.verification_reference ?? \"\")");
    expect(verify.match(/and verification_reference = \$\{originalVerificationReference\}/g)).toHaveLength(2);
    expect(verify.match(/returning id::text/g)).toHaveLength(2);
    expect(verify).toContain("where claim.id = ${claimId}::uuid");
    expect(verify).toContain("row = refreshedRows[0]");
  });

  it("does not let a stale reset cancel newer or already-verified evidence", () => {
    const send = source("src/app/api/public-directory/claim-email/send/route.ts");

    expect(send).toContain("const originalVerificationReference = String(existing.verification_reference ?? \"\")");
    expect(send).toContain("and verification_reference = ${originalVerificationReference}");
    expect(send).toContain("and verification_reference not like '%\"stage\":\"business_email_verified\"%'");
    expect(send).toContain("returning id::text");
    expect(send).toContain("if (!resetRows[0]?.id)");
  });
});
