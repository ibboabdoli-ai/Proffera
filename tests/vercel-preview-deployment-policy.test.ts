import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";

import { describe, expect, it } from "vitest";

/** Mirrors Vercel's additive branch-rule behavior for the policy cases under test. */
function deploymentEnabledForBranch(rules: Record<string, boolean>, branch: string) {
  return Object.entries(rules)
    .filter(([pattern]) => matchesGlob(branch, pattern))
    .some(([, enabled]) => enabled);
}

describe("Vercel preview deployment policy", () => {
  it("allows automatic Git deployments only for main and explicit worker previews", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      git?: {
        deploymentEnabled?: Record<string, boolean>;
      };
    };
    const rules = config.git?.deploymentEnabled;

    expect(rules).toEqual({
      "**": false,
      main: true,
      "work/proffera-preview-*": true,
    });
    expect(rules).toBeDefined();
    if (!rules) throw new Error("Vercel deployment rules are required");

    // Vercel deploys when any matching rule is true. The preview exception
    // stays inside the repository-required work/proffera-* branch convention.
    expect(deploymentEnabledForBranch(rules, "main")).toBe(true);
    expect(deploymentEnabledForBranch(rules, "work/proffera-preview-qa")).toBe(true);
    expect(deploymentEnabledForBranch(rules, "work/proffera-qa")).toBe(false);
    expect(deploymentEnabledForBranch(rules, "demo/qa")).toBe(false);
    expect(deploymentEnabledForBranch(rules, "fix/qa")).toBe(false);
  });
});
