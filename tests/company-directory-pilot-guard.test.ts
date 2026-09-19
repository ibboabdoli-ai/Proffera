import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLocaleLowerCase("sv-SE");
}

describe("company directory pilot database guard", () => {
  it("records the legacy registered/profile-location guard for migration history", () => {
    const sql = source("db/migrations/20260810_0041_company_profile_pilot_location_guard.sql");

    expect(sql).toContain("company_directory_profiles_pilot_location_guard");
    expect(sql).toContain("publication_status <> 'published'");
    expect(sql).toContain("stockholm");
    expect(sql).toContain("södertälje");
  });

  it("supersedes the legacy guard with canonical fresh SCB workplace authority", () => {
    const sql = source("db/migrations/20260919_0068_company_directory_pilot_workplace_guard.sql");

    expect(sql).toContain("drop constraint if exists company_directory_profiles_pilot_location_guard");
    expect(sql).toContain("company_directory_enforce_pilot_workplace_publication");
    expect(sql).toContain("create trigger company_directory_profiles_pilot_workplace_guard");
    expect(sql).toContain("company_directory_scb_enrichment");
    expect(sql).toContain("company_directory_official_facts");
    expect(sql).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(sql).toContain("comparisonsnapshot,profileupdatedtoken");
    expect(sql).toContain("comparisonsnapshot,officialfactslastsyncedtoken");
    expect(sql).toContain("jsonb_array_length");
    expect(sql).toContain("visitingaddress");
    expect(sql).toContain("stockholm");
    expect(sql).toContain("södertälje");
    expect(sql).toContain("set publication_status = 'review'");
    expect(sql).toContain("'20260919_0068'");
    expect(sql).toContain("insert into proffera_schema_migrations");
  });
});
