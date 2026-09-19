import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DIRECTORY_PILOT_LOCATIONS } from "../src/lib/company-directory-policy";

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
    expect(sql).toContain("old.publication_status = 'published'");
    expect(sql).toContain("to_jsonb(new) - array['publication_status', 'published_at', 'updated_at']::text[]");
    expect(sql).toContain("to_jsonb(old) - array['publication_status', 'published_at', 'updated_at']::text[]");
    expect(sql).toContain("company_directory_scb_enrichment");
    expect(sql).toContain("company_directory_official_facts");
    expect(sql).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(sql).toContain("comparisonsnapshot,profileupdatedtoken");
    expect(sql).toContain("comparisonsnapshot,officialfactslastsyncedtoken");
    expect(sql).toContain("jsonb_array_length");
    expect(sql).toContain("jsonb_typeof(scb.conflicts) = 'array'");
    expect(sql).toContain("jsonb_array_length(scb.conflicts) = 0");
    expect(sql).toContain("else true");
    expect(sql).toContain("visitingaddress");
    expect(sql).toContain("stockholm");
    expect(sql).toContain("södertälje");
    expect(sql).toContain("set publication_status = 'review'");
    expect(sql).toContain("'20260919_0068'");
    expect(sql).toContain("insert into proffera_schema_migrations");
  });

  it("backfills legacy location-derived auto-public eligibility without publishing rows", () => {
    const sql = source("db/migrations/20260919_0069_company_directory_non_location_eligibility_backfill.sql");

    expect(sql).toContain("set auto_public_eligible = true");
    expect(sql).toContain("organization_kind = 'juridical_person'");
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("privacy_blocked = false");
    expect(sql).toContain("category_slug");
    expect(sql).toContain("primary_sni_not_confirmed");
    expect(sql).toContain("company_directory_scb_enrichment");
    expect(sql).toContain("company_directory_official_facts");
    expect(sql).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(sql).toContain("facts.deregistration_date is null");
    expect(sql).toContain("coalesce(facts.advertising_blocked, false) = false");
    expect(sql).toContain("jsonb_typeof(facts.ongoing_procedures) = 'array'");
    expect(sql).toContain("then jsonb_array_length(facts.ongoing_procedures)");
    expect(sql).toContain("else 1");
    expect(sql).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(sql).toContain("comparisonsnapshot,profileupdatedtoken");
    expect(sql).toContain("comparisonsnapshot,officialfactslastsyncedtoken");
    expect(sql).toContain("outside_pilot_area");
    expect(sql).toContain("missing_city");
    expect(sql).toContain("jsonb_typeof(scb.workplaces) = 'array'");
    expect(sql).toContain("jsonb_typeof(scb.conflicts) = 'array'");
    expect(sql).toContain("stockholm");
    expect(sql).toContain("södertälje");
    expect(sql).not.toContain("set publication_status = 'published'");
    expect(sql).toContain("'20260919_0069'");
    expect(sql).toContain("insert into proffera_schema_migrations");
  });

  it("keeps every database pilot-location list synchronized with the canonical policy", () => {
    const sql = source("db/migrations/20260919_0068_company_directory_pilot_workplace_guard.sql");
    const lists = [...sql.matchAll(/\bin\s*\(([^)]+)\)/gu)]
      .map((match) => [...(match[1] ?? "").matchAll(/'([^']+)'/gu)].map((item) => item[1]))
      .filter((items) => items.length > 0);

    expect(lists).toHaveLength(4);
    for (const locations of lists) {
      expect(locations).toEqual([...DIRECTORY_PILOT_LOCATIONS]);
    }
  });
});
