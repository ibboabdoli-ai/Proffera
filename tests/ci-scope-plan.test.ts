import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type CiScopePlan = {
  policyVersion: number;
  mode: string;
  classification: string;
  reductionCandidate: boolean;
  fullCiStillRequired: boolean;
  proposedLanes: string[];
  execution: {
    lint: boolean;
    typecheck: boolean;
    unit: boolean;
    build: boolean;
    e2e: boolean;
    discoveryWorker: boolean;
  };
  reasons: string[];
  files: string[];
};

function plan(files: string[]): CiScopePlan {
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/ci-scope-plan.mjs")],
    {
      encoding: "utf8",
      input: `${files.join("\n")}\n`,
    },
  );

  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as CiScopePlan;
}

function expectFullExecution(result: CiScopePlan) {
  expect(result.execution).toEqual({
    lint: true,
    typecheck: true,
    unit: true,
    build: true,
    e2e: true,
    discoveryWorker: true,
  });
}

describe("targeted CI scope planner", () => {
  it("activates the trusted targeted policy for docs-only changes", () => {
    const result = plan(["docs/README.md"]);

    expect(result.policyVersion).toBe(2);
    expect(result.mode).toBe("targeted");
    expect(result.fullCiStillRequired).toBe(false);
    expect(result.classification).toBe("low-docs");
    expect(result.reductionCandidate).toBe(true);
    expect(result.proposedLanes).toEqual(["governance", "whitespace"]);
    expect(result.execution).toEqual({
      lint: false,
      typecheck: false,
      unit: false,
      build: false,
      e2e: false,
      discoveryWorker: false,
    });
  });

  it("maps a public app change to static, unit, build, and browser lanes", () => {
    const result = plan(["src/app/page.tsx", "src/components/Hero.tsx"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.reductionCandidate).toBe(true);
    expect(result.fullCiStillRequired).toBe(false);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
      "build",
      "e2e",
    ]);
    expect(result.execution).toEqual({
      lint: true,
      typecheck: true,
      unit: true,
      build: true,
      e2e: true,
      discoveryWorker: false,
    });
  });

  it("keeps browser coverage for non-public source changes", () => {
    const result = plan(["src/lib/format.ts"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.reductionCandidate).toBe(true);
    expect(result.fullCiStillRequired).toBe(false);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
      "build",
      "e2e",
    ]);
    expect(result.execution.e2e).toBe(true);
    expect(result.execution.discoveryWorker).toBe(false);
    expect(result.reasons[0]).toContain("browser lanes");
  });

  it("maps unit-test-only changes without requiring build or browser lanes", () => {
    const result = plan(["tests/example.test.ts"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.fullCiStillRequired).toBe(false);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
    ]);
    expect(result.execution).toEqual({
      lint: true,
      typecheck: true,
      unit: true,
      build: false,
      e2e: false,
      discoveryWorker: false,
    });
  });

  it("maps browser-test-only changes to static analysis and the browser lane", () => {
    const result = plan(["e2e/tests/public-smoke.e2e.mjs"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.fullCiStillRequired).toBe(false);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "e2e",
    ]);
    expect(result.execution).toEqual({
      lint: true,
      typecheck: true,
      unit: false,
      build: false,
      e2e: true,
      discoveryWorker: false,
    });
  });

  it.each([
    ["workflow", ".github/workflows/ci.yml"],
    ["api", "src/app/api/quotes/route.ts"],
    ["database", "db/migrations/0060_example.sql"],
    ["auth", "src/lib/auth/session.ts"],
    ["admin authorization", "src/lib/admin-authorization.ts"],
    ["admin navigation", "src/lib/admin-navigation.ts"],
    ["workspace", "src/lib/workspace/access.ts"],
    ["payment", "src/lib/stripe/webhook.ts"],
    ["directory", "src/lib/company-directory/project.ts"],
    ["privacy", "src/app/en/privacy/page.tsx"],
    ["localized privacy", "src/app/integritetspolicy/page.tsx"],
    ["nested lockfile", "e2e/package-lock.json"],
    ["worker control", "AGENTS.md"],
    ["discovery worker test", "tests/test_company_directory_discovery_worker.py"],
  ])("keeps %s paths on the full conservative lane set", (_label, file) => {
    const result = plan([file]);

    expect(result.classification).toBe("restricted-full");
    expect(result.reductionCandidate).toBe(false);
    expect(result.fullCiStillRequired).toBe(true);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
      "build",
      "e2e",
      "discovery-worker",
    ]);
    expectFullExecution(result);
  });

  it("keeps both sides of a rename in trusted scope evidence", () => {
    const shadowWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/ci-scope-shadow.yml"),
      "utf8",
    );
    const requiredWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    const renameQuery = "--jq '.[] | .filename, (.previous_filename // empty)'";
    expect(shadowWorkflow).toContain(renameQuery);
    expect(requiredWorkflow).toContain(renameQuery);
    expect(requiredWorkflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(requiredWorkflow).toContain(".policyVersion >= 2");
    expect(requiredWorkflow).toContain('and .mode == "targeted"');

    const result = plan([
      "docs/retired-workflow.md",
      ".github/workflows/retired.yml",
    ]);
    expect(result.classification).toBe("restricted-full");
    expect(result.reductionCandidate).toBe(false);
    expectFullExecution(result);
  });

  it("fails unknown paths conservatively to full CI", () => {
    const result = plan(["ops/new-tool.sh"]);

    expect(result.classification).toBe("conservative-full");
    expect(result.reductionCandidate).toBe(false);
    expect(result.fullCiStillRequired).toBe(true);
    expect(result.reasons[0]).toContain("Unmapped path defaults to full CI");
    expectFullExecution(result);
  });

  it("fails empty changed-file input conservatively to full CI", () => {
    const result = plan([]);

    expect(result.classification).toBe("conservative-full");
    expect(result.reductionCandidate).toBe(false);
    expect(result.fullCiStillRequired).toBe(true);
    expectFullExecution(result);
  });

  it("treats control-plane regression tests as full-CI scope", () => {
    const result = plan(["tests/tooling-safety-contract.test.ts"]);

    expect(result.classification).toBe("restricted-full");
    expect(result.reductionCandidate).toBe(false);
    expectFullExecution(result);
  });
});
