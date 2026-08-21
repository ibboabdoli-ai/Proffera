import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory full admin details", () => {
  it("keeps the complete data explorer behind super-admin authorization", () => {
    const pageCode = source("src/app/admin/foretag/directory/details/page.tsx");
    const layoutCode = source("src/app/admin/foretag/directory/layout.tsx");

    expect(pageCode).toContain("await requireSuperAdmin()");
    expect(pageCode).toContain("to_jsonb(p) as profile");
    expect(pageCode).toContain("to_jsonb(facts) as official_facts");
    expect(pageCode).toContain("to_jsonb(scb) as scb");
    expect(pageCode).toContain("company_directory_profile_services");
    expect(pageCode).toContain("company_directory_business_locations");
    expect(pageCode).toContain("company_directory_field_sources");
    expect(layoutCode).toContain('/admin/foretag/directory/details');
  });

  it("shows SCB freshness, conflicts and separate visiting/postal workplace addresses", () => {
    const pageCode = source("src/app/admin/foretag/directory/details/page.tsx");

    expect(pageCode).toContain("scb_snapshot_fresh");
    expect(pageCode).toContain("scb_conflict_count");
    expect(pageCode).toContain('label="Besöksadress"');
    expect(pageCode).toContain('label="Postadress"');
    expect(pageCode).toContain('label="Telefon"');
    expect(pageCode).toContain('label="E-post"');
    expect(pageCode).toContain('Raw Official Facts');
    expect(pageCode).toContain('Raw SCB enrichment');
  });
});
