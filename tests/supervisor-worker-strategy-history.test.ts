import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { decideWorkerStrategyHistory, workerMaterialScopeChanged, workerStrategyDescriptor, workerStrategyObservation } from "../scripts/supervisor-worker-strategy-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { parseWorkerStrategyDispatchStarts } from "../scripts/supervisor-worker-handoff.mjs";

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
const prior = (packet = basePacket, outcome = "failed", runId: number | null = null, runAttempt = 1) => {
  const descriptor = workerStrategyDescriptor(packet);
  return {
    action_id: "worker_codex_attempt",
    outcome,
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
    observations: runId === null ? [] : [{
      head: packet.base_sha,
      source: {kind: "actions", run_id: runId, attempt: runAttempt, job_id: null},
    }],
  };
};
const dispatchStart = (packet = basePacket, runId = 20, runAttempt = 1) => {
  const descriptor = workerStrategyDescriptor(packet);
  return {
    task_id: packet.task_id,
    run_id: runId,
    run_attempt: runAttempt,
    head: packet.base_sha,
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

describe("Worker material baseline scope", () => {
  it("detects only changes inside the Task Packet allowed scope", () => {
    expect(workerMaterialScopeChanged(basePacket, ["scripts/a.mjs"])).toBe(true);
    expect(workerMaterialScopeChanged(basePacket, ["scripts/other.mjs"])).toBe(false);
    expect(workerMaterialScopeChanged({...basePacket, allowed_paths: ["scripts/"]}, ["scripts/nested/a.mjs"])).toBe(true);
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

  it("allows automatic re-entry after a material baseline change", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(old, "failed", 20, 1)],
      materially_changed_heads: [old.base_sha],
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", material_reentries: 1});
  });

  it("still suppresses unrelated baseline SHA churn", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(old, "failed", 20, 1)],
      materially_changed_heads: [],
    }).decision).toBe("SUPPRESS_REPEAT");
  });

  it("allows material re-entry past an unresolved start from the old baseline", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [],
      dispatch_starts: [dispatchStart(old, 20, 1)],
      materially_changed_heads: [old.base_sha],
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", unresolved_attempts: 0});
  });

  it("allows explicit trusted owner re-entry without treating it as new material evidence", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "OWNER-RETRY"},
      source: {mode: "comment", actor: "ibboabdoli-ai"},
      records: [prior()],
    }).decision).toBe("ALLOW_HUMAN_REENTRY");
  });

  it("suppresses a matching unresolved dispatch-start before durable outcome persistence", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "PLANNER-RETRY", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [],
      dispatch_starts: [dispatchStart()],
    })).toMatchObject({decision: "SUPPRESS_UNRESOLVED_ATTEMPT", unresolved_attempts: 1});
  });

  it("does not treat a resolved dispatch-start as uncertain once its exact run attempt is durable", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "PLANNER-RETRY", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(basePacket, "failed", 20, 1)],
      dispatch_starts: [dispatchStart(basePacket, 20, 1)],
    })).toMatchObject({decision: "SUPPRESS_REPEAT", unresolved_attempts: 0});
  });

  it("allows explicit owner re-entry for an unresolved matching dispatch-start", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "OWNER-UNCERTAIN"},
      source: {mode: "comment", actor: "ibboabdoli-ai"},
      records: [],
      dispatch_starts: [dispatchStart()],
    })).toMatchObject({decision: "ALLOW_HUMAN_REENTRY", unresolved_attempts: 1});
  });

  it("does not let an unrelated unresolved strategy block materially different work", () => {
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_goal: "A genuinely different material goal"},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [],
      dispatch_starts: [dispatchStart()],
    }).decision).toBe("ALLOW");
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
  it("persists material strategy identity with dispatch-start evidence before the model boundary", () => {
    const startIndex = workflow.indexOf("proffera-worker-strategy-start:v1:");
    expect(startIndex).toBeGreaterThan(0);
    expect(startIndex).toBeLessThan(workflow.indexOf("Run one bounded implementation Worker"));
    expect(workflow).toContain("Baseline SHA:");
    expect(workflow).toContain("Evidence fingerprint:");
    expect(workflow).toContain("Strategy fingerprint:");
    expect(workflow).toContain("worker-strategy-descriptor");
  });

  it("validates packet scope before a Worker attempt can be classified as succeeded", () => {
    const scope = workflow.indexOf("Validate Worker candidate packet scope before strategy success");
    const classify = workflow.indexOf("Classify bounded Worker strategy outcome");
    const refuse = workflow.indexOf("Refuse a started Worker attempt without a validated candidate");
    expect(scope).toBeGreaterThan(workflow.indexOf("Confirm validated Worker tree matches uploaded candidate"));
    expect(scope).toBeLessThan(classify);
    expect(workflow.slice(scope, classify)).toContain("validate-changes");
    expect(workflow.slice(scope, classify)).toContain("git show HEAD:scripts/supervisor-worker-handoff.mjs");
    expect(workflow.slice(classify, refuse)).toContain("SCOPE_OUTCOME");
    expect(workflow.slice(classify, refuse)).toContain('[ "$SCOPE_OUTCOME" = "success" ]');
  });

  it("marks the model boundary and persists history from the isolated issue-write job", () => {
    expect(workflow.indexOf("Mark Worker strategy attempt start")).toBeLessThan(workflow.indexOf("Run one bounded implementation Worker"));
    expect(workflow.indexOf("Persist Worker strategy outcome before publication decision"))
      .toBeLessThan(workflow.indexOf("Refuse failed or unvalidated Worker candidate"));
    expect(workflow).toContain("worker-strategy-record");
  });

  it("parses only versioned trusted strategy-start evidence with exact run binding", () => {
    const descriptor = workerStrategyDescriptor(basePacket);
    const body = [
      "<!-- proffera-worker-dispatch-start:B4-WORKER-1:20 -->",
      "<!-- proffera-worker-strategy-start:v1:B4-WORKER-1:20 -->",
      "- Task ID: `B4-WORKER-1`",
      "- GitHub Run ID: `20`",
      "- Run Attempt: `1`",
      `- Baseline SHA: \`${basePacket.base_sha}\``,
      `- Evidence fingerprint: \`${descriptor.evidence_fingerprint}\``,
      `- Strategy fingerprint: \`${descriptor.strategy_fingerprint}\``,
      "- State: `DISPATCH_STARTED`",
    ].join("\n");
    expect(parseWorkerStrategyDispatchStarts([{
      user: {login: "github-actions[bot]", type: "Bot"},
      body,
    }])).toEqual([dispatchStart(basePacket, 20, 1)]);
  });
  it("keeps write authority out of the model-executing dispatch job", () => {
    const dispatch = workflow.slice(workflow.indexOf("  dispatch:"), workflow.indexOf("  publish:"));
    expect(dispatch).toContain("issues: read");
    expect(dispatch).not.toContain("issues: write");
  });
});
