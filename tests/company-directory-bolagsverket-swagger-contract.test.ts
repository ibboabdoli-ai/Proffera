import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Bolagsverket Värdefulla datamängder Swagger contract", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/company-directory-source.ts"),
    "utf8",
  );
  const detailValidation = readFileSync(
    resolve(process.cwd(), "src/lib/company-directory-detail-validation.ts"),
    "utf8",
  );
  const identityValidation = readFileSync(
    resolve(process.cwd(), "src/lib/company-directory-official-facts-errors.ts"),
    "utf8",
  );
  const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

  it("keeps the documented /organisationer POST request shape", () => {
    expect(envExample).toContain("COMPANY_DIRECTORY_DETAIL_METHOD=POST");
    expect(envExample).toContain("COMPANY_DIRECTORY_OAUTH_SCOPE=vardefulla-datamangder:read");
    expect(source).toContain("JSON.stringify({ identitetsbeteckning: organizationNumber })");
    expect(source).toContain('"content-type": "application/json"');
    expect(source).toContain('authorization: `Bearer ${token}`');
    expect(source).toContain('"x-request-id": randomUUID()');
  });

  it("fails closed when HTTP 200 contains field-level Bolagsverket/SCB errors", () => {
    expect(detailValidation).toContain("collectBolagsverketApiErrors(payload)");
    expect(detailValidation).toContain("Bolagsverket response contains incomplete data");
    expect(source).toContain("resolveCompleteBolagsverketOrganizationRecord(payload, organizationNumber)");
  });

  it("keeps the public Directory lookup limited to organization-number identities", () => {
    expect(identityValidation).toContain('!/^\\d{10}$/.test(requested)');
    expect(identityValidation).toContain('["ORGNR", "ORGANISATIONSNUMMER"]');
    expect(identityValidation).toContain("unsupported identity type");
  });
});
