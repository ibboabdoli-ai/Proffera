import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as {
  load: (source: string) => unknown;
};

type YamlRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): YamlRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a YAML mapping`);
  }
  return value as YamlRecord;
}

function namedStep(stepsValue: unknown, name: string): YamlRecord {
  if (!Array.isArray(stepsValue)) {
    throw new Error("preview-safe-smoke steps must be an array");
  }

  const step = stepsValue.find((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return false;
    }
    return (entry as YamlRecord).name === name;
  });

  if (!step) {
    throw new Error(`Missing workflow step: ${name}`);
  }
  return asRecord(step, `step ${name}`);
}

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/preview-safe-smoke.yml"),
  "utf8",
);
const parsedWorkflow = asRecord(parseYaml(workflow), "workflow");
const jobs = asRecord(parsedWorkflow.jobs, "jobs");
const previewJob = asRecord(jobs["preview-safe-smoke"], "preview-safe-smoke job");

describe("Preview safe browser smoke workflow", () => {
  it("binds runtime proof to the exact pull-request head Preview deployment", () => {
    expect(previewJob.if).toBe(
      "github.event.pull_request.head.repo.full_name == github.repository && startsWith(github.event.pull_request.head.ref, 'work/proffera-preview-e2e-')",
    );

    const checkout = namedStep(previewJob.steps, "Checkout exact pull request head");
    expect(checkout.uses).toBe(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    );
    expect(asRecord(checkout.with, "checkout with")).toEqual({
      ref: "${{ github.event.pull_request.head.sha }}",
      "persist-credentials": false,
    });

    const resolver = namedStep(previewJob.steps, "Resolve exact-head Vercel Preview");
    expect(resolver.shell).toBe("bash");
    expect(asRecord(resolver.env, "resolver env")).toEqual({
      GH_TOKEN: "${{ github.token }}",
      REPOSITORY: "${{ github.repository }}",
      HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
    });

    const resolverRun = String(resolver.run);
    expect(resolverRun).toContain("deployments?sha=${HEAD_SHA}&per_page=20");
    expect(resolverRun).toContain('select(.state == "success")');
    expect(resolverRun).toContain('(.environment // "") != "Production"');
    expect(resolverRun).toContain('(.environment // "") != "production"');
    expect(resolverRun).toContain('[[ "${host}" == *.vercel.app ]]');
    expect(resolverRun).toContain('[ "${host}" != "proffera.se" ]');
    expect(resolverRun).toContain('[ "${host}" != "www.proffera.se" ]');
    expect(resolverRun).toContain('[ "${host}" != "chat.proffera.se" ]');
  });

  it("keeps the workflow read-only and without OIDC or repository write authority", () => {
    const expectedPermissions = {
      contents: "read",
      deployments: "read",
    };

    expect(asRecord(parsedWorkflow.permissions, "workflow permissions")).toEqual(
      expectedPermissions,
    );
    expect(asRecord(previewJob.permissions, "job permissions")).toEqual(
      expectedPermissions,
    );
  });

  it("runs only non-submitting public browser journeys against Preview", () => {
    const smoke = namedStep(previewJob.steps, "Run read-only public Preview smoke");
    expect(smoke["working-directory"]).toBe("e2e");
    expect(asRecord(smoke.env, "smoke env")).toEqual({
      E2E_BASE_URL: "${{ steps.preview.outputs.url }}",
      E2E_ALLOW_REMOTE: "true",
    });
    expect(smoke.run).toBe(
      "npx playwright test tests/public-critical-flows.e2e.mjs tests/public-marketing.e2e.mjs --project=chromium --reporter=line --retries=0",
    );
  });
});
