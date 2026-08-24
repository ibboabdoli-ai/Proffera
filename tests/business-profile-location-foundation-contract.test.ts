import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Business Profile multi-location foundation", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "db/migrations/20260824_0067_business_profile_location_foundation.sql"),
    "utf8",
  ).toLocaleLowerCase("sv-SE");

  it("models purpose, visibility and visitability explicitly", () => {
    expect(sql).toContain("company_directory_profile_locations");
    expect(sql).toContain("'registered', 'postal', 'workplace', 'storefront', 'service_base'");
    expect(sql).toContain("'private', 'approximate', 'public'");
    expect(sql).toContain("is_visitable boolean not null default false");
  });

  it("fails closed for new rows and exact public map eligibility", () => {
    expect(sql).toContain("visibility text not null default 'private'");
    expect(sql).toContain("visibility <> 'public'");
    expect(sql).toContain("confirmed_at is not null");
    expect(sql).toContain("is_visitable");
    expect(sql).toContain("purpose in ('workplace', 'storefront', 'service_base')");
  });

  it("supports multiple locations without backfilling or changing current matching", () => {
    expect(sql).toContain("id uuid primary key default gen_random_uuid()");
    expect(sql).toContain("create unique index if not exists company_directory_profile_locations_primary_idx");
    expect(sql).not.toContain("insert into company_directory_profile_locations\nselect");
    expect(sql).not.toContain("update company_directory_business_locations");
    expect(sql).not.toContain("drop table company_directory_business_locations");
  });

  it("records the canonical migration in the Production schema ledger", () => {
    expect(sql).toContain("'20260824_0067'");
    expect(sql).toContain("'20260824_0067_business_profile_location_foundation.sql'");
    expect(sql).toContain("on conflict (migration_key) do nothing");
  });
});
