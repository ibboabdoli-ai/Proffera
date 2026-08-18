import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory profile service sync", () => {
  const engine = source("src/lib/company-directory-engine.ts");

  it("creates the canonical SNI service relation whenever a profile is upserted", () => {
    expect(engine).toContain("mapPrimarySniToDirectorySearchService(candidate.primarySniCode)");
    expect(engine).toContain("insert into company_directory_profile_services");
    expect(engine).toContain("select ${profileId}::uuid, service.slug, 'sni', 85, true, true, true");
  });

  it("reactivates only SNI-owned conflicts instead of overriding owner or admin evidence", () => {
    expect(engine).toContain("where company_directory_profile_services.source_type = 'sni'");
  });

  it("deactivates stale SNI-derived relations when the primary SNI mapping changes", () => {
    expect(engine).toContain("update company_directory_profile_services");
    expect(engine).toContain("and source_type = 'sni'");
    expect(engine).toContain("service_slug <> ${sniServiceSlug ?? \"\"}");
    expect(engine).toContain("public_visible = false");
  });
});
