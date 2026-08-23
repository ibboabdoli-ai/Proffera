import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SCB workplace municipality projection contract", () => {
  const enrichmentSource = source("src/lib/company-directory-scb-enrichment.ts");

  it("never projects conflicted SCB evidence into a Directory profile", () => {
    expect(enrichmentSource).toContain("if (conflicts.length > 0) return;");
  });

  it("never overwrites claimed Workspace-owned municipality data", () => {
    expect(enrichmentSource).toContain("and profile.claimed_workspace_id is null");
  });

  it("records workplace-specific provenance instead of company-seat provenance", () => {
    expect(enrichmentSource).toContain("'scb_foretagsregistret:workplace'");
    expect(enrichmentSource).toContain("selectedWorkplace?.cfarNumber");
  });
});
