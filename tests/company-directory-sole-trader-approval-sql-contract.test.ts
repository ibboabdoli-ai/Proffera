import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("sole-trader approval SQL contract", () => {
  it("casts the claim id used inside jsonb_build_object so Postgres can type the bound parameter", () => {
    const approvalSource = source("src/lib/company-directory-sole-trader-owner.ts");

    expect(approvalSource).toContain("'claimId', ${claimId}::text");
    expect(approvalSource).not.toContain("'claimId', ${claimId},\n          'status', 'claimed'");
  });
});
