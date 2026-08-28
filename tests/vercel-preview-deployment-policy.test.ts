import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";

import { describe, expect, it } from "vitest";

function deploymentEnabledForBranch(rules: Record<string, boolean>, branch: string) {
  return Object.entries(rules)
    .filter(([pattern]) => matchesGlob(branch, pattern))
    .some(([, enabled]) => enabled);
}

describe("Vercel preview deployment policy", () => {
  it("allows automatic Git deployments only for main and explicit preview branches", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      git?: {
        deploymentEnabled?: Record<string, boolean>;
      };
    };
    const rules = config.git?.deploymentEnabled;

    expect(rules).toEqual({
      "**": false,
      main: true,
      "preview/*": true,
    });
    expect(rules).toBeDefined();
    if (!rules) throw new Error("Vercel deployment rules are required");

    // Vercel deploys when any matching rule is true. Exercise that behavior
    // so the broad deny rule cannot accidentally block main/intentional previews.
    expect(deploymentEnabledForBranch(rules, "main")).toBe(true);
    expect(deploymentEnabledForBranch(rules, "preview/qa")).toBe(true);
    expect(deploymentEnabledForBranch(rules, "demo/qa")).toBe(false);
    expect(deploymentEnabledForBranch(rules, "fix/qa")).toBe(false);
  });
});
