import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type ShadowPlan = {
  policyVersion: number;
  mode: string;
  classification: string;
  reductionCandidate: boolean;
  fullCiStillRequired: boolean;
  proposedLanes: string[];
  reasons: string[];
  files: string[];
};

function plan(files: string[]): ShadowPlan {
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/ci-scope-plan.mjs")],
    {
      encoding: "utf8",
      input: `${files.join("\n")}\n`,
    },
  );

  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as ShadowPlan;
}

describe("targeted CI shadow planner", () => {
  it("keeps the planner advisory even for reduction candidates", () => {
    const result = plan(["docs/README.md"]);

    expect(result.mode).toBe("shadow");
    expect(result.fullCiStillRequired).toBe(true);
    expect(result.classification).toBe("low-docs");
    expect(result.reductionCandidate).toBe(true);
    expect(result.proposedLanes).toEqual(["governance", "whitespace"]);
  });

  it("maps a public app change to static, unit, build, and browser lanes", () => {
    const result = plan(["src/app/page.tsx", "src/components/Hero.tsx"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.reductionCandidate).toBe(true);
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
      "build",
      "e2e",
    ]);
  });

  it("maps unit-test-only changes without requiring build or browser lanes", () => {
    const result = plan(["tests/example.test.ts"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.proposedLanes).toEqual([
      "governance",
      "whitespace",
      "lint",
      "typecheck",
      "unit",
    ]);
    expect(result.proposedLanes).not.toContain("build");
    expect(result.proposedLanes).not.toContain("e2e");
  });

  it("maps browser-test-only changes to the browser lane", () => {
    const result = plan(["e2e/tests/public-smoke.spec.ts"]);

    expect(result.classification).toBe("low-mapped");
    expect(result.proposedLanes).toContain("e2e");
    expect(result.proposedLanes).not.toContain("build");
  });

  it.each([
    ["workflow", ".github/workflows/ci.yml"],
    ["api", "src/app/api/quotes/route.ts"],
    ["database", "db/migrations/0060_example.sql"],
    ["auth", "src/lib/auth/session.ts"],
    ["workspace", "src/lib/workspace/access.ts"],
    ["payment", "src/lib/stripe/webhook.ts"],
    ["directory", "src/lib/company-directory/project.ts"],
    ["privacy", "src/app/en/privacy/page.tsx"],
    ["nested lockfile", "e2e/package-lock.json"],
    ["worker control", "AGENTS.md"],
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
  });

  it("fails unknown paths conservatively to full CI", () => {
    const result = plan(["ops/new-tool.sh"]);

    expect(result.classification).toBe("conservative-full");
    expect(result.reductionCandidate).toBe(false);
    expect(result.reasons[0]).toContain("Unmapped path defaults to full CI");
  });

  it("treats control-plane regression tests as full-CI scope", () => {
    const result = plan(["tests/tooling-safety-contract.test.ts"]);

    expect(result.classification).toBe("restricted-full");
    expect(result.reductionCandidate).toBe(false);
  });
});
