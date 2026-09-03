import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  path.join(process.cwd(), ".github/workflows/marketplace-preview-browser-e2e.yml"),
  "utf8",
);

describe("Marketplace Preview browser workflow", () => {
  it("pins the test to the exact same-repository branch and exact pull-request head", () => {
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.pull_request.head.ref == 'work/proffera-marketplace-browser-lifecycle-e2e'");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("deployments: read");
  });

  it("accepts only an HTTPS Vercel Preview URL and blocks Production hosts", () => {
    expect(workflow).toContain('[[ "${host}" == *.vercel.app ]]');
    expect(workflow).toContain('[ "${protocol}" = "https:" ]');
    expect(workflow).toContain('[ "${host}" != "proffera.se" ]');
    expect(workflow).toContain('[ "${host}" != "www.proffera.se" ]');
    expect(workflow).toContain('select((.environment // "") != "Production"');
  });
});
