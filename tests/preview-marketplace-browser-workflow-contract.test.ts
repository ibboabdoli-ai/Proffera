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
const retryRunner = readFileSync(
  path.join(process.cwd(), "e2e/run-marketplace-preview-lifecycle.sh"),
  "utf8",
);

function permissionsFrom(block: string) {
  return Object.fromEntries(block
    .trim()
    .split("\n")
    .map((line) => line.replace(/\s+#.*$/u, "").trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

function topLevelPermissions() {
  const match = /^permissions:\n((?:  [^\n]+\n)+)/mu.exec(workflow);
  expect(match?.[1]).toBeTruthy();
  return permissionsFrom(match?.[1] ?? "");
}

function previewJobPermissions() {
  const match = /^    permissions:\n((?:      [^\n]+\n)+)/mu.exec(workflow);
  expect(match?.[1]).toBeTruthy();
  return permissionsFrom(match?.[1] ?? "");
}

describe("Marketplace Preview browser workflow", () => {
  it("pins the test to the exact same-repository branch and exact pull-request head", () => {
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("github.event.pull_request.head.ref == 'work/proffera-marketplace-browser-lifecycle-e2e'");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.head.sha }}");
  });

  it("keeps workflow permissions read-only and scopes OIDC minting to the Preview browser job", () => {
    expect(topLevelPermissions()).toEqual({
      contents: "read",
      deployments: "read",
    });
    expect(previewJobPermissions()).toEqual({
      contents: "read",
      deployments: "read",
      "id-token": "write",
    });
    expect(workflow).toContain("# Read the exact pull-request head; no repository writes.");
    expect(workflow).toContain("# Mint short-lived GitHub OIDC only for this Preview E2E job.");
  });

  it("mints the exact-audience credential inside every process-level Playwright attempt", () => {
    expect(retryRunner).toContain('readonly oidc_audience="proffera-marketplace-preview-e2e"');
    expect(retryRunner).toContain('readonly max_playwright_attempts=2');
    expect(retryRunner).toContain('for playwright_attempt in $(seq 1 "${max_playwright_attempts}")');
    expect(retryRunner).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(retryRunner).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
    expect(retryRunner).toContain('audience=${oidc_audience}');
    expect(retryRunner).toContain("jq -er '.value | strings | select(length > 0)'");
    expect(retryRunner.indexOf("oidc_token=\"$(curl")).toBeGreaterThan(retryRunner.indexOf("for playwright_attempt"));
    expect(retryRunner.indexOf("npx playwright test")).toBeGreaterThan(retryRunner.indexOf("oidc_token=\"$(curl"));
    expect(retryRunner).toContain("--retries=0");
    expect(playwrightConfig).toContain("retries: marketplacePreviewLifecycle ? 0 : process.env.CI ? 1 : 0");
  });

  it("passes each OIDC credential only to that Playwright process without logging or exporting it", () => {
    expect(retryRunner).toContain('PROFFERA_PREVIEW_E2E_OIDC_TOKEN="${oidc_token}"');
    expect(retryRunner).not.toContain('echo "${oidc_token}"');
    expect(retryRunner).not.toContain("GITHUB_ENV");
    expect(retryRunner).not.toContain("GITHUB_OUTPUT");
    expect((retryRunner.match(/\$\{oidc_token\}/gu) ?? [])).toHaveLength(1);
    expect(workflow).not.toContain("PROFFERA_PREVIEW_E2E_OIDC_TOKEN");
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

  it("keeps the deployment poll alive across transient GitHub API failures", () => {
    expect(workflow).toContain('if ! deployments="$(curl --fail --silent --show-error');
    expect(workflow).toContain("Transient deployments API error on attempt ${attempt}/60; retrying.");
    expect(workflow).toContain('if ! statuses="$(curl --fail --silent --show-error');
    expect(workflow).toContain("Transient deployment-status API error for ${deployment_id}; continuing.");
  });

  it("pins every Preview workflow action to an immutable commit SHA even with inline comments", () => {
    const actionRefs = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map((match) => match[1]);
    expect(actionRefs).toHaveLength(2);
    for (const ref of actionRefs) expect(ref).toMatch(/@[0-9a-f]{40}$/u);
  });

  it("accepts only an HTTPS Vercel Preview URL and blocks Production hosts", () => {
    expect(workflow).toContain('[[ "${host}" == *.vercel.app ]]');
    expect(workflow).toContain('[ "${protocol}" = "https:" ]');
    expect(workflow).toContain('[ "${host}" != "proffera.se" ]');
    expect(workflow).toContain('[ "${host}" != "www.proffera.se" ]');
    expect(workflow).toContain('select((.environment // "") != "Production"');
  });
});
