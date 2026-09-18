import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/preview-safe-smoke.yml"),
  "utf8",
);

describe("Preview safe browser smoke workflow", () => {
  it("binds runtime proof to the exact pull-request head Preview deployment", () => {
    expect(workflow).toContain("deployments?sha=${HEAD_SHA}");
    expect(workflow).toContain("github.event.pull_request.head.sha");
    expect(workflow).toContain("*.vercel.app");
    expect(workflow).toContain('startsWith(github.event.pull_request.head.ref, \'work/proffera-preview-e2e-\')');
  });

  it("keeps the workflow read-only and without OIDC or repository write authority", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("deployments: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("id-token: write");
    expect(workflow).not.toContain("pull-requests: write");
  });

  it("runs only non-submitting public browser journeys against Preview", () => {
    expect(workflow).toContain("tests/public-critical-flows.e2e.mjs");
    expect(workflow).toContain("tests/public-marketing.e2e.mjs");
    expect(workflow).toContain('E2E_ALLOW_REMOTE: "true"');
    expect(workflow).not.toContain("marketplace-preview-lifecycle.e2e.mjs");
    expect(workflow).not.toContain("preview-marketplace-lifecycle.e2e.mjs");
  });
});
