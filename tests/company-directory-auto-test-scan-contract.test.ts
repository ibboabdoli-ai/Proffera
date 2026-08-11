import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("automatic Bolagsverket TEST scan contract", () => {
  it("keeps the automatic scan preview-only and read-only", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/foretag/directory/test-scan/route.ts"),
      "utf8",
    );
    const page = readFileSync(
      resolve(process.cwd(), "src/app/admin/foretag/directory/auto-scan/page.tsx"),
      "utf8",
    );
    const client = readFileSync(
      resolve(process.cwd(), "src/app/admin/foretag/directory/preview/DirectoryTestAutoScan.tsx"),
      "utf8",
    );

    expect(route).toContain('process.env.VERCEL_ENV === "production"');
    expect(route).toContain("BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.slice");
    expect(route).toContain("previewCompanyDirectorySource");
    expect(route).not.toContain("company_directory_profiles");
    expect(route).not.toContain("company_directory_sync_runs");
    expect(page).toContain("Preview only · read-only");
    expect(page).toContain("Endpointen är blockerad i Production");
    expect(client).toContain("Skanna alla automatiskt");
    expect(client).toContain("await new Promise");
  });
});
