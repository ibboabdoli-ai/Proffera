import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory seed pilot contract", () => {
  it("defaults the documented pilot to explicit seed organisation numbers", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(envExample).toContain("COMPANY_DIRECTORY_DISCOVERY_MODE=seed");
    expect(envExample).toContain("COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS=");
    expect(envExample).toContain("COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE=");
    expect(envExample).not.toContain('COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE={"identitetsbeteckning"');
  });

  it("requires the official detail endpoint and OAuth before a seed Källtest", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-source-preview-admin.ts"),
      "utf8",
    );
    expect(source).toContain('type DiscoveryMode = "seed" | "feed"');
    expect(source).toContain("detailRequestConfigured()");
    expect(source).toContain("Official test OAuth credentials are required for seed mode");
    expect(source).toContain("documented /organisationer request body is built in");
  });

  it("allows manual Källtest only for documented Bolagsverket TEST identities", () => {
    const testdata = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-bolagsverket-testdata.ts"),
      "utf8",
    );
    const previewSource = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-source-preview-admin.ts"),
      "utf8",
    );
    const previewPage = readFileSync(
      resolve(process.cwd(), "src/app/admin/foretag/directory/preview/page.tsx"),
      "utf8",
    );

    expect(testdata).toContain('"5560021361"');
    expect(testdata).toContain("never guess organisation numbers");
    expect(previewSource).toContain("isBolagsverketVdmTestOrganizationNumber");
    expect(previewSource).toContain("Endast officiellt dokumenterade Bolagsverket TEST-identiteter");
    expect(previewPage).toContain("Testa org.nr");
    expect(previewPage).toContain("Testa 5 officiella");
  });
});
