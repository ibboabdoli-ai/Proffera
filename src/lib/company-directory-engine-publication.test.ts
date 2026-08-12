import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const engineSource = readFileSync(new URL("./company-directory-engine.ts", import.meta.url), "utf8");

describe("company directory publication persistence", () => {
  it("preserves a manually published profile when an eligible resync is only ready", () => {
    expect(engineSource).toContain("company_directory_profiles.publication_status = 'published'");
    expect(engineSource).toContain("excluded.publication_status = 'ready'");
    expect(engineSource).toContain("excluded.privacy_blocked = false");
    expect(engineSource).toContain("excluded.auto_public_eligible = true");
    expect(engineSource).toContain("then 'published'");
  });

  it("preserves published_at for the same safe resync path", () => {
    expect(engineSource).toContain("then coalesce(company_directory_profiles.published_at, now())");
  });

  it("still lets unsafe or ineligible assessments fall through to their new status", () => {
    expect(engineSource).toContain("else excluded.publication_status");
  });
});
