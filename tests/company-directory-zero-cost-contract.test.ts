import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("company directory zero-extra-cost contract", () => {
  it("hard-caps pilot sync volume and batches provenance writes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-engine.ts"),
      "utf8",
    );

    expect(source).toContain("PILOT_MAX_PAGES_PER_RUN = 2");
    expect(source).toContain("PILOT_MAX_BATCH_SIZE = 10");
    expect(source).toContain("jsonb_array_elements(${provenanceJson}::jsonb)");
    expect(source).toContain("on conflict do nothing");
  });

  it("keeps automatic sync and publication disabled by default", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(envExample).toContain("COMPANY_DIRECTORY_SYNC_ENABLED=false");
    expect(envExample).toContain("COMPANY_DIRECTORY_AUTO_PUBLISH=false");
    expect(envExample).toContain("COMPANY_DIRECTORY_BATCH_SIZE=10");
    expect(envExample).toContain("COMPANY_DIRECTORY_MAX_PAGES_PER_RUN=2");
  });
});
