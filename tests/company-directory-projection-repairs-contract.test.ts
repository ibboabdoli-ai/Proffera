import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20260821_0056_company_directory_projection_repairs.sql"),
  "utf8",
);

describe("Company Directory projection repair migration", () => {
  it("seeds the Frisör service and backfills SNI 96.210 relations", () => {
    expect(migration).toContain("'frisor', 'Frisör'");
    expect(migration).toContain("'Frisör / Barberare'");
    expect(migration).toContain("profile.primary_sni_code = '96.210'");
    expect(migration).toContain("profile.id, 'frisor', 'sni', 85");
    expect(migration).toContain("where company_directory_profile_services.source_type = 'sni'");
  });

  it("fills only blank profile municipalities from matching SCB enrichment with provenance", () => {
    expect(migration).toContain("profile.organization_number = scb.organization_number");
    expect(migration).toContain("nullif(trim(profile.municipality), '') is null");
    expect(migration).toContain("nullif(trim(scb.municipality), '') is not null");
    expect(migration).toContain("'municipality'");
    expect(migration).toContain("'scb_foretagsregistret'");
    expect(migration).toContain("encode(digest(trim(scb.municipality), 'sha256'), 'hex')");
  });

  it("does not change publication status or profile updated_at during the backfill", () => {
    expect(migration).not.toMatch(/set\s+publication_status\s*=/iu);
    const municipalityBackfill = migration.slice(migration.indexOf("with candidates as"));
    expect(municipalityBackfill).not.toMatch(/set\s+updated_at\s*=/iu);
  });
});
