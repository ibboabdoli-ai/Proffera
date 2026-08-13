import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory service + location foundation", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "db/migrations/20260813_0045_company_directory_service_location_foundation.sql"),
    "utf8",
  ).toLocaleLowerCase("sv-SE");

  it("adds normalized service and geo-ready boundaries", () => {
    expect(sql).toContain("company_directory_service_categories");
    expect(sql).toContain("company_directory_services");
    expect(sql).toContain("company_directory_profile_services");
    expect(sql).toContain("company_directory_business_locations");
    expect(sql).toContain("company_directory_service_areas");
  });

  it("keeps service areas private until a real source confirms them", () => {
    expect(sql).toContain("public_visible boolean not null default false");
    expect(sql).toContain("source_type in ('website', 'admin', 'owner')");
  });

  it("backfills only existing SNI-derived service slugs", () => {
    expect(sql).toContain("unnest(profile.service_slugs)");
    expect(sql).toContain("'sni'");
    expect(sql).toContain("fine-grained child services");
  });

  it("does not change publication state", () => {
    expect(sql).not.toContain("update company_directory_profiles\nset publication_status");
    expect(sql).not.toContain("company_directory_auto_publish");
  });
});
