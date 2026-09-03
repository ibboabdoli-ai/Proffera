import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  path.join(process.cwd(), ".github/workflows/marketplace-preview-browser-e2e.yml"),
  "utf8",
);
const playwrightConfig = readFileSync(
  path.join(process.cwd(), "e2e/playwright.config.mjs"),
  "utf8",
);

describe("Marketplace Preview browser workflow", () => {
  it("pins the test to the exact same-repository branch and exact pull-request head", () => {
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.pull_request.head.ref == 'work/proffera-marketplace-browser-lifecycle-e2e'");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("deployments: read");
  });

  it("grants only the additional OIDC permission and mints the exact-audience credential", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain('OIDC_AUDIENCE: "proffera-marketplace-preview-e2e"');
    expect(workflow).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(workflow).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
    expect(workflow).toContain('audience=${OIDC_AUDIENCE}');
    expect(workflow).toContain("jq -er '.value | strings | select(length > 0)'");
  });

  it("passes the OIDC credential only to the Playwright process without logging or exporting it", () => {
    expect(workflow).toContain('PROFFERA_PREVIEW_E2E_OIDC_TOKEN="${oidc_token}"');
    expect(workflow).toContain("npx playwright test tests/marketplace-preview-lifecycle.e2e.mjs");
    expect(workflow).not.toContain('echo "${oidc_token}"');
    expect(workflow).not.toContain('echo "oidc_token=');
    expect(workflow).not.toContain('oidc_token}" >> "${GITHUB_OUTPUT}"');
    expect((workflow.match(/\$\{oidc_token\}/gu) ?? [])).toHaveLength(1);
  });

  it("injects the secure credential into the separate request fixture through a path-scoped cookie", () => {
    expect(playwrightConfig).toContain("process.env.PROFFERA_PREVIEW_E2E_OIDC_TOKEN");
    expect(playwrightConfig).toContain('const previewAuthCookieName = "__Secure-proffera-preview-e2e-auth"');
    expect(playwrightConfig).toContain('path: "/api/e2e/marketplace/"');
    expect(playwrightConfig).toContain("httpOnly: true");
    expect(playwrightConfig).toContain("secure: true");
    expect(playwrightConfig).toContain("storageState: previewAuthStorageState");
    expect(playwrightConfig).toContain('trace: previewOidcToken ? "off" : "retain-on-failure"');
  });

  it("accepts only an HTTPS Vercel Preview URL and blocks Production hosts", () => {
    expect(workflow).toContain('[[ "${host}" == *.vercel.app ]]');
    expect(workflow).toContain('[ "${protocol}" = "https:" ]');
    expect(workflow).toContain('[ "${host}" != "proffera.se" ]');
    expect(workflow).toContain('[ "${host}" != "www.proffera.se" ]');
    expect(workflow).toContain('select((.environment // "") != "Production"');
  });
});
