import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory claim business email evidence", () => {
  it("freezes a verified business-email claim before admin review", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/api/public-directory/claim-email/send/route.ts"),
      "utf8",
    );

    expect(source).toContain('existingEvidence?.stage === "business_email_verified"');
    expect(source).toContain("company_directory_claims.verification_method = 'email_domain'");
    expect(source).toContain('company_directory_claims.verification_reference like \'%"stage":"business_email_verified"%\'');
    expect(source).toContain("?status=sent");
  });
});
