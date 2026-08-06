import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Industry service seeding", () => {
  it("covers every onboarding industry with useful service templates", () => {
    const code = source("src/lib/workspace-service-seeding.ts");

    for (const key of ["salon", "cleaning", "window_cleaning", "consulting", "repair", "healthcare", "restaurant", "other"]) {
      expect(code).toContain(`${key}: [`);
    }
    expect(code).toContain("durationMinutes");
    expect(code).toContain("Pris på förfrågan");
  });

  it("is workspace scoped and never overwrites existing services", () => {
    const code = source("src/lib/workspace-service-seeding.ts");

    expect(code).toContain("where existing.workspace_id = ${access.workspaceId}");
    expect(code).toContain("where not exists");
    expect(code).not.toContain("delete from workspace_services");
    expect(code).not.toContain("update workspace_services");
  });

  it("connects onboarding industry selection to automatic seeding", () => {
    const code = source("src/app/dashboard/onboarding/page.tsx");

    expect(code).toContain("seedWorkspaceServicesForIndustry(industryKey)");
    expect(code).toContain("Befintliga tjänster skrivs aldrig över");
  });
});
