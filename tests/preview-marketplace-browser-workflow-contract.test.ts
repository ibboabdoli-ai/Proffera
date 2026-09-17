import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Evidence-only refresh: trigger the isolated Preview lifecycle against current main without changing runtime behavior.
const workflow = readFileSync(
  path.join(process.cwd(), ".github/workflows/marketplace-preview-browser-e2e.yml"),
  "utf8",
);

describe("Marketplace Preview browser workflow contract", () => {
  it("keeps the hosted browser lifecycle opt-in and fail-closed", () => {
    expect(workflow).toContain("E2E_MARKETPLACE_PREVIEW_LIFECYCLE: true");
    expect(workflow).toContain("Resolve successful isolated Vercel Preview deployment");
    expect(workflow).toContain("run-marketplace-preview-lifecycle.sh");
  });
});