import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("sole-trader privacy projection contract", () => {
  it("redacts sole-trader organization identity from the public Directory view", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-public-data.ts"),
      "utf8",
    );

    expect(source).toContain('String(organizationKind ?? "") === "sole_trader" ? ""');
    expect(source).toContain("organizationNumber: publicOrganizationNumber(row.organization_kind, row.organization_number)");
  });

  it("uses an opaque surrogate and identifier-independent public slug for persisted sole traders", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-sole-trader-owner.ts"),
      "utf8",
    );

    expect(source).toContain("const surrogateIdentity = `sole-trader-${profileId}`");
    expect(source).toContain("slugifyDirectoryBusiness(input.business.companyName)");
    expect(source).not.toContain("sourceRecordId: identity10");
    expect(source).not.toContain("sourceRecordId: identity12");
  });
});
