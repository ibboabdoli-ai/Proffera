import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/release-rollback-plan.mjs");
const currentSha = "a".repeat(40);
const targetSha = "b".repeat(40);
const targetDeploymentUrl = "https://proffera-known-good-123.vercel.app";

function run(databaseChange: string, overrides: Record<string, string> = {}) {
  const input = JSON.stringify({
    currentSha,
    targetSha,
    targetDeploymentUrl,
    databaseChange,
    ...overrides,
  });
  const result = spawnSync(process.execPath, [script, input], { encoding: "utf8" });
  const parsed = JSON.parse(result.stdout || result.stderr) as Record<string, unknown>;
  return { result, parsed };
}

describe("release rollback dry-run contract", () => {
  it("accepts an exact known-good Vercel target for code-only rollback planning", () => {
    const { result, parsed } = run("none");

    expect(result.status).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.automaticMutation).toBe(false);
    expect(parsed.databaseRollback).toBe(false);
    expect(parsed.healthVerification).toBe("exact-sha-required");
  });

  it("allows additive database change only as an application rollback plan", () => {
    const { result, parsed } = run("additive");

    expect(result.status).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.requiresSeparateDatabaseApproval).toBe(false);
  });

  it("fails closed for destructive or unknown database impact", () => {
    for (const databaseChange of ["destructive", "unknown"]) {
      const { result, parsed } = run(databaseChange);
      expect(result.status).toBe(1);
      expect(parsed.ok).toBe(false);
      expect(parsed.requiresSeparateDatabaseApproval).toBe(true);
    }
  });

  it("rejects ambiguous rollback targets", () => {
    expect(run("none", { targetSha: currentSha }).result.status).toBe(1);
    expect(run("none", { targetDeploymentUrl: "https://proffera.se" }).result.status).toBe(1);
    expect(run("none", { targetDeploymentUrl: "http://example.vercel.app" }).result.status).toBe(1);
  });
});
