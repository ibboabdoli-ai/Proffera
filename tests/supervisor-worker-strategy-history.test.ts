import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { decideWorkerStrategyHistory, workerStrategyDescriptor, workerStrategyObservation } from "../scripts/supervisor-worker-strategy-memory.mjs";

const basePacket = {
  task_id: "B4-WORKER-1",
  task_title: "Wire Worker strategy history",
  task_goal: "Prevent unchanged failed Worker strategies from being repeated automatically.",
  base_sha: "a".repeat(40),
  branch: "work/proffera-b4-worker-strategy-history",
  graph_path: "supervisor/worker/strategy-history",
  allowed_paths: ["scripts/a.mjs", "tests/a.test.ts"],
  forbidden_paths: ["db/migrations/"],
  required_checks: ["validate", "codeql", "targeted-ci-shadow", "production-base-health", "ai-review", "final-gate"],
  risk_class: 3,
  production_mutation_allowed: false,
  merge_allowed: false,
  auto_merge_allowed: false,
};
const prior = (packet = basePacket, outcome = "failed") => {
  const descriptor = workerStrategyDescriptor(packet);
  return {
    action_id: "worker_codex_attempt",
    outcome,
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
  };
};

describe("Worker strategy-history material identity", () => {
  it("does not let task IDs, branches, titles, or base-SHA churn buy another attempt", () => {
    const a = workerStrategyDescriptor(basePacket);
    const b = workerStrategyDescriptor({
      ...basePacket,
      task_id: "B4-WORKER-999",
      task_title: "Renamed transport task",
      branch: "work/proffera-different-transport",
      base_sha: "b".repeat(40),
    });
    expect(b.evidence_fingerprint).toBe(a.evidence_fingerprint);
    expect(b.strategy_fingerprint).toBe(a.strategy_fingerprint);
  });

  it.each([
    ["goal", {task_goal: "A materially different goal"}],
    ["graph", {graph_path: "supervisor/worker/different-node"}],
    ["allowed scope", {allowed_paths: ["scripts/b.mjs"]}],
    ["forbidden scope", {forbidden_paths: ["src/lib/auth.ts"]}],
    ["risk", {risk_class: 4}],
  ])("changes the evidence fingerprint for material %s changes", (_name, patch) => {
    expect(workerStrategyDescriptor({...basePacket, ...patch}).evidence_fingerprint)
      .not.toBe(workerStrategyDescriptor(basePacket).evidence_fingerprint);
  });
});

describe("Worker strategy-history admission", () => {
  it("allows the first automatic attempt", () => {
    expect(decideWorkerStrategyHistory({
      packet: basePacket,
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [],
    }).decision).toBe("ALLOW");
  });

  it.each(["failed", "no_change", "cancelled", "succeeded"])(
    "suppresses an unchanged automatic strategy after %s",
    (outcome) => {
      expect(decideWorkerStrategyHistory({
        packet: {...basePacket, task_id: "NEW-TASK", base_sha: "c".repeat(40)},
        source: {mode: "planner", actor: "github-actions[bot]"},
        records: [prior(basePacket, outcome)],
      }).decision).toBe("SUPPRESS_REPEAT");
    },
  );

  it("allows explicit trusted owner re-entry without treating it as new material evidence", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "OWNER-RETRY"},
      source: {mode: "comment", actor: "ibboabdoli-ai"},
      records: [prior()],
    }).decision).toBe("ALLOW_HUMAN_REENTRY");
  });

  it("fails closed for an untrusted source even when history is empty", () => {
    expect(() => decideWorkerStrategyHistory({
      packet: basePacket,
      source: {mode: "comment", actor: "untrusted-user"},
      records: [],
    })).toThrow("untrusted_source");
  });

  it("records failed and successful attempts with explicit stop/re-entry semantics", () => {
    const failed = workerStrategyObservation({
      packet: basePacket, repository: "ibboabdoli-ai/Proffera", outcome: "failed",
      run_id: 10, run_attempt: 1, observed_at: "2026-10-03T05:00:00.000Z",
    });
    const succeeded = workerStrategyObservation({
      packet: basePacket, repository: "ibboabdoli-ai/Proffera", outcome: "succeeded",
      run_id: 11, run_attempt: 1, observed_at: "2026-10-03T05:01:00.000Z",
    });
    expect(failed.stop.kind).toBe("same_evidence_strategy_failed");
    expect(failed.reentry.kind).toBe("human_evidence");
    expect(succeeded.stop.kind).toBe("none");
    expect(succeeded.reentry.kind).toBe("human_evidence");
  });
});

describe("Worker workflow B4.1 wiring", () => {
  const workflow = readFileSync(".github/workflows/supervisor-worker-handoff.yml", "utf8").replaceAll("\r\n", "\n");
  it("admits by strategy history before the Codex boundary", () => {
    expect(workflow.indexOf("worker-strategy-admit")).toBeGreaterThan(0);
    expect(workflow.indexOf("worker-strategy-admit")).toBeLessThan(workflow.indexOf("Run one bounded implementation Worker"));
  });
  it("marks the model boundary and persists history from the isolated issue-write job", () => {
    expect(workflow.indexOf("Mark Worker strategy attempt start")).toBeLessThan(workflow.indexOf("Run one bounded implementation Worker"));
    expect(workflow.indexOf("Persist Worker strategy outcome before publication decision"))
      .toBeLessThan(workflow.indexOf("Refuse failed or unvalidated Worker candidate"));
    expect(workflow).toContain("worker-strategy-record");
  });
  it("keeps write authority out of the model-executing dispatch job", () => {
    const dispatch = workflow.slice(workflow.indexOf("  dispatch:"), workflow.indexOf("  publish:"));
    expect(dispatch).toContain("issues: read");
    expect(dispatch).not.toContain("issues: write");
  });
});
