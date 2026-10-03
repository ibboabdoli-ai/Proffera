import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { decideWorkerStrategyHistory, WORKER_EXECUTION_CONTRACT, workerMaterialScopeChanged, workerStrategyDescriptor, workerStrategyObservation } from "../scripts/supervisor-worker-strategy-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import * as workerStrategyModule from "../scripts/supervisor-worker-strategy-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, serializeMemory } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { materialWorkerBaselineHeads, parseWorkerStrategyDispatchStarts, workerFailureMemorySnapshots } from "../scripts/supervisor-worker-handoff.mjs";

const basePacket = {
  task_id: "B4-WORKER-1",
  task_title: "Wire Worker strategy history",
  task_goal: "Prevent unchanged failed Worker strategies from being repeated automatically.",
  base_sha: "a".repeat(40),
  branch: "work/proffera-b4-worker-strategy-history",
  graph_path: "supervisor/worker/strategy-history",
  allowed_paths: ["scripts/a.mjs", "tests/a.test.ts"],
  dependency_paths: ["src/contracts/worker-policy.ts"],
  forbidden_paths: ["db/migrations/"],
  required_checks: ["validate", "codeql", "targeted-ci-shadow", "production-base-health", "ai-review", "final-gate"],
  risk_class: 3,
  production_mutation_allowed: false,
  merge_allowed: false,
  auto_merge_allowed: false,
};
const prior = (packet = basePacket, outcome = "failed", runId: number | null = null, runAttempt = 1, resultHead: string | null = null) => {
  const descriptor = workerStrategyDescriptor(packet);
  return {
    action_id: "worker_codex_attempt",
    outcome,
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
    observations: runId === null ? [] : [{
      head: outcome === "succeeded" && resultHead ? resultHead : packet.base_sha,
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
    dependency_paths: [...(packet.dependency_paths ?? [])].sort(),
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
  };
};

function gitFixture(changedPath: string) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-worker-strategy-"));
  mkdirSync(join(dir, "scripts"), {recursive: true});
  mkdirSync(join(dir, "src", "contracts"), {recursive: true});
  writeFileSync(join(dir, "scripts", "a.mjs"), "export const value = 1;\n");
  writeFileSync(join(dir, "src", "contracts", "worker-policy.ts"), "export const policy = 1;\n");
  writeFileSync(join(dir, "src", "contracts", "new-unrelated.ts"), "export const unrelated = 1;\n");
  writeFileSync(join(dir, "src", "unrelated.ts"), "export const other = 1;\n");
  execFileSync("git", ["init", "-q"], {cwd: dir});
  execFileSync("git", ["config", "user.email", "tests@proffera.local"], {cwd: dir});
  execFileSync("git", ["config", "user.name", "Proffera Tests"], {cwd: dir});
  execFileSync("git", ["add", "."], {cwd: dir});
  execFileSync("git", ["commit", "-q", "-m", "baseline"], {cwd: dir});
  const oldHead = execFileSync("git", ["rev-parse", "HEAD"], {cwd: dir, encoding: "utf8"}).trim();
  writeFileSync(join(dir, ...changedPath.split("/")), "export const changed = 2;\n");
  execFileSync("git", ["add", changedPath], {cwd: dir});
  execFileSync("git", ["commit", "-q", "-m", "change"], {cwd: dir});
  const currentHead = execFileSync("git", ["rev-parse", "HEAD"], {cwd: dir, encoding: "utf8"}).trim();
  return {dir, oldHead, currentHead};
}

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

  it("binds strategy identity to the canonical execution contract", () => {
    const current = workerStrategyDescriptor(basePacket);
    const same = workerStrategyDescriptor(basePacket, {...WORKER_EXECUTION_CONTRACT});
    const changed = workerStrategyDescriptor(basePacket, {
      ...WORKER_EXECUTION_CONTRACT,
      prompt_version: "worker_builder_v2",
      prompt: WORKER_EXECUTION_CONTRACT.prompt + "\nUse the v2 bounded Builder contract.",
    });
    expect(same.strategy_fingerprint).toBe(current.strategy_fingerprint);
    expect(changed.strategy_fingerprint).not.toBe(current.strategy_fingerprint);
    expect(changed.evidence_fingerprint).toBe(current.evidence_fingerprint);
    expect(decideWorkerStrategyHistory({
      packet: basePacket,
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [{
        ...prior(),
        strategy_fingerprint: changed.strategy_fingerprint,
      }],
    }).decision).toBe("ALLOW");
  });

  it("keeps dependency declaration churn outside stable attempt identity", () => {
    const expected = workerStrategyDescriptor(basePacket).evidence_fingerprint;
    for (const dependency_paths of [
      [],
      ["src/contracts/other-policy.ts"],
      ["src/contracts/worker-policy.ts", "src/contracts/other-policy.ts"],
      ["src/contracts/other-policy.ts", "src/contracts/worker-policy.ts"],
      ["src/contracts/worker-policy.ts", "src/contracts/worker-policy.ts"],
    ]) {
      const descriptor = workerStrategyDescriptor({...basePacket, dependency_paths});
      expect(descriptor.evidence_fingerprint).toBe(expected);
      expect(descriptor.strategy_fingerprint).toBe(workerStrategyDescriptor(basePacket).strategy_fingerprint);
    }
  });
});

describe("Worker material baseline scope", () => {
  it("detects writable and previously authenticated dependency changes only", () => {
    expect(workerMaterialScopeChanged(basePacket, ["scripts/a.mjs"])).toBe(true);
    expect(workerMaterialScopeChanged(basePacket, ["src/contracts/worker-policy.ts"], basePacket.dependency_paths)).toBe(true);
    expect(workerMaterialScopeChanged(basePacket, ["src/contracts/new-unrelated.ts"], basePacket.dependency_paths)).toBe(false);
    expect(workerMaterialScopeChanged(basePacket, ["scripts/other.mjs"])).toBe(false);
    expect(workerMaterialScopeChanged({...basePacket, allowed_paths: ["scripts/"]}, ["scripts/nested/a.mjs"])).toBe(true);
  });

  it.each([
    ["authenticated dependency change", "src/contracts/worker-policy.ts", true],
    ["newly declared unrelated dependency change", "src/contracts/new-unrelated.ts", false],
    ["allowed writable change", "scripts/a.mjs", true],
    ["unrelated main change", "src/unrelated.ts", false],
  ])("derives %s from real git baselines without trusting current dependency drift", (_name, changedPath, reenter) => {
    const fixture = gitFixture(changedPath);
    try {
      const old = {...basePacket, base_sha: fixture.oldHead};
      const current = {...basePacket, task_id: "NEW-TASK", base_sha: fixture.currentHead,
        dependency_paths: ["src/contracts/new-unrelated.ts"]};
      const records = [prior(old, "failed", 20, 1)];
      const starts = [dispatchStart(old, 20, 1)];
      const heads = materialWorkerBaselineHeads(current, records, starts, workerStrategyModule, fixture.dir);
      expect(heads).toEqual(reenter ? [fixture.oldHead] : []);
      expect(decideWorkerStrategyHistory({
        packet: current,
        source: {mode: "planner", actor: "github-actions[bot]"},
        records,
        dispatch_starts: starts,
        materially_changed_heads: heads,
      }).decision).toBe(reenter ? "ALLOW_MATERIAL_REENTRY" : "SUPPRESS_REPEAT");
    } finally {
      rmSync(fixture.dir, {recursive: true, force: true});
    }
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

  it("does not let dependency declaration drift buy another automatic attempt", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40),
        dependency_paths: ["src/contracts/new-unrelated.ts"]},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(old, "failed", 20, 1)],
    }).decision).toBe("SUPPRESS_REPEAT");
  });

  it("allows automatic re-entry after a material baseline change", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(old, "failed", 20, 1)],
      materially_changed_heads: [old.base_sha],
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", material_reentries: 1});
  });

  it("keeps a successful strategy blocked on its own published result and reopens only after later relevant evidence", () => {
    const fixture = gitFixture("scripts/a.mjs");
    try {
      const original = {...basePacket, base_sha: fixture.oldHead};
      const published = {...basePacket, task_id: "SUCCESS-REPLAY", base_sha: fixture.currentHead};
      const success = prior(original, "succeeded", 30, 1, fixture.currentHead);
      const starts = [dispatchStart(original, 30, 1)];

      const unchangedHeads = materialWorkerBaselineHeads(published, [success], starts, workerStrategyModule, fixture.dir);
      expect(unchangedHeads).toEqual([]);
      expect(decideWorkerStrategyHistory({
        packet: published,
        source: {mode: "planner", actor: "github-actions[bot]"},
        records: [success],
        dispatch_starts: starts,
        materially_changed_heads: unchangedHeads,
      }).decision).toBe("SUPPRESS_REPEAT");

      writeFileSync(join(fixture.dir, "scripts", "a.mjs"), "export const changedAgain = 3;\n");
      execFileSync("git", ["add", "scripts/a.mjs"], {cwd: fixture.dir});
      execFileSync("git", ["commit", "-q", "-m", "later relevant evidence"], {cwd: fixture.dir});
      const laterHead = execFileSync("git", ["rev-parse", "HEAD"], {cwd: fixture.dir, encoding: "utf8"}).trim();
      const later = {...published, base_sha: laterHead};
      const laterHeads = materialWorkerBaselineHeads(later, [success], starts, workerStrategyModule, fixture.dir);
      expect(laterHeads).toEqual([fixture.currentHead]);
      expect(decideWorkerStrategyHistory({
        packet: later,
        source: {mode: "planner", actor: "github-actions[bot]"},
        records: [success],
        dispatch_starts: starts,
        materially_changed_heads: laterHeads,
      }).decision).toBe("ALLOW_MATERIAL_REENTRY");
    } finally {
      rmSync(fixture.dir, {recursive: true, force: true});
    }
  });

  it("keeps ambiguous legacy success provenance fail-closed", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    const legacySuccess = prior(old, "succeeded", 31, 1);
    expect(decideWorkerStrategyHistory({
      packet: {...old, task_id: "LEGACY-SUCCESS", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [legacySuccess],
      dispatch_starts: [],
      materially_changed_heads: [],
    }).decision).toBe("SUPPRESS_REPEAT");
  });

  it("keeps recoverable-only success resolvable and fail-closed until owner re-entry", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    const current = {...basePacket, task_id: "RECOVERABLE-SUCCESS", base_sha: "b".repeat(40)};
    const records = [prior(old, "succeeded", 32, 1)];
    const starts = [dispatchStart(old, 32, 1)];
    expect(materialWorkerBaselineHeads(current, records, starts, workerStrategyModule)).toEqual([]);
    expect(decideWorkerStrategyHistory({
      packet: current,
      source: {mode: "planner", actor: "github-actions[bot]"},
      records,
      dispatch_starts: starts,
      materially_changed_heads: [],
    }).decision).toBe("SUPPRESS_REPEAT");
    expect(decideWorkerStrategyHistory({
      packet: current,
      source: {mode: "comment", actor: "ibboabdoli-ai"},
      records,
      dispatch_starts: starts,
      materially_changed_heads: [],
    }).decision).toBe("ALLOW_HUMAN_REENTRY");
  });

  it("suppresses replay after a material re-entry attempt starts on the refreshed baseline", () => {
    const old = {...basePacket, base_sha: "a".repeat(40)};
    const current = {...basePacket, task_id: "NEW-TASK", base_sha: "b".repeat(40)};
    expect(decideWorkerStrategyHistory({
      packet: current,
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [prior(old, "failed", 20, 1), prior(current, "failed", 21, 1)],
      dispatch_starts: [dispatchStart(old, 20, 1), dispatchStart(current, 21, 1)],
      materially_changed_heads: [old.base_sha],
    }).decision).toBe("SUPPRESS_REPEAT");
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

  it("keeps a legacy start without dependency metadata fail-closed", () => {
    const legacyStart = {...dispatchStart()};
    Reflect.deleteProperty(legacyStart, "dependency_paths");
    expect(decideWorkerStrategyHistory({
      packet: {...basePacket, task_id: "PLANNER-LEGACY", base_sha: "b".repeat(40)},
      source: {mode: "planner", actor: "github-actions[bot]"},
      records: [],
      dispatch_starts: [legacyStart],
    })).toMatchObject({decision: "SUPPRESS_UNRESOLVED_ATTEMPT", unresolved_attempts: 1});
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
      result_head: "b".repeat(40),
    });
    expect(failed.stop.kind).toBe("same_evidence_strategy_failed");
    expect(failed.reentry.kind).toBe("human_evidence");
    expect(succeeded.stop.kind).toBe("none");
    expect(succeeded.reentry.kind).toBe("human_evidence");
    expect(succeeded.head).toBe("b".repeat(40));
    const recoverable = workerStrategyObservation({
      packet: basePacket, repository: "ibboabdoli-ai/Proffera", outcome: "succeeded",
      run_id: 12, run_attempt: 1, observed_at: "2026-10-03T05:02:00.000Z",
    });
    expect(recoverable.head).toBe(basePacket.base_sha);
  });
});

describe("Worker Failure Memory indexing", () => {
  it("scans a near-bound 5000-comment snapshot once while indexing many scopes", async () => {
    let bodyReads = 0;
    const comments = Array.from({length: 5000}, (_, index) => {
      const body = index < 100
        ? serializeMemory(createMemory("ibboabdoli-ai/Proffera", {kind: "task", task_id: `BULK-${index}`}))
        : `ordinary supervisor comment ${index}`;
      const comment = {
        id: index + 1000,
        user: {login: "github-actions[bot]", type: "Bot"},
        issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
      } as Record<string, unknown>;
      Object.defineProperty(comment, "body", {
        enumerable: true,
        get() {
          bodyReads += 1;
          return body;
        },
      });
      return comment;
    });

    const {current, snapshots} = await workerFailureMemorySnapshots("ibboabdoli-ai/Proffera", basePacket, comments);
    expect(current).toMatchObject({comment_id: null, memory: {scope: {kind: "task", task_id: basePacket.task_id}}});
    expect(snapshots).toHaveLength(101);
    expect(bodyReads).toBe(5000);
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
    expect(workflow).toContain("Dependency paths:");
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

  it("rechecks strategy history under the reservation mutex before acquiring a Worker slot", () => {
    const reserveStart = workflow.indexOf("Atomically reserve writable Worker slot");
    const dispatchEvidence = workflow.indexOf("Persist trusted Worker dispatch-start evidence");
    const reserve = workflow.slice(reserveStart, dispatchEvidence);
    expect(reserve.indexOf("reservation-mutex-acquire")).toBeGreaterThanOrEqual(0);
    expect(reserve.indexOf("worker-strategy-admit")).toBeGreaterThan(reserve.indexOf("reservation-mutex-acquire"));
    expect(reserve.indexOf("worker-strategy-admit")).toBeLessThan(reserve.indexOf("reservation-acquire"));
  });

  it("records non-success early and delays succeeded until publication is recoverable", () => {
    const early = workflow.indexOf("Persist non-success Worker strategy outcome before publication decision");
    const publish = workflow.indexOf("Publish branch normally or persist validated recovery artifact");
    const recoverable = workflow.indexOf("Mark reservation recoverable after durable artifact upload");
    const success = workflow.indexOf("Persist successful Worker strategy outcome after recoverable publication");
    expect(early).toBeGreaterThan(workflow.indexOf("  publish:"));
    expect(early).toBeLessThan(publish);
    expect(workflow.slice(early, publish)).toContain("attempt_outcome != 'succeeded'");
    expect(success).toBeGreaterThan(recoverable);
    expect(workflow.slice(success)).toContain('state" = "PUBLISHED"');
    expect(workflow.slice(success)).toContain('state" = "RECOVERABLE"');
    expect(workflow.slice(success)).toContain('outcome:"succeeded"');
    expect(workflow.slice(success)).toContain('success_result_head="$HEAD_SHA"');
    expect(workflow.slice(success)).toContain('result_head:(if $result_head == "" then null else $result_head end)');
  });

  it("materializes the Worker strategy-history dependency chain with the trusted publication helper", () => {
    const materialize = workflow.slice(
      workflow.indexOf("Materialize trusted publication helper in isolated job"),
      workflow.indexOf("Persist non-success Worker strategy outcome before publication decision"),
    );
    expect(materialize).toContain("supervisor-worker-handoff.mjs");
    expect(materialize).toContain("supervisor-worker-strategy-memory.mjs");
    expect(materialize).toContain("supervisor-failure-memory.mjs");
    expect(materialize).toContain('sha256sum "$trusted_helper" "$trusted_strategy" "$trusted_failure"');
  });

  it("binds the model boundary to the canonical Worker execution contract", () => {
    const contract = workflow.indexOf("Load canonical Worker execution contract");
    const model = workflow.indexOf("Run one bounded implementation Worker");
    expect(contract).toBeGreaterThan(0);
    expect(contract).toBeLessThan(model);
    expect(workflow.slice(contract, model)).toContain('.execution_contract.action_revision');
    expect(workflow.slice(contract, model)).toContain('.execution_contract.effort');
    expect(workflow.slice(model, workflow.indexOf("Capture untrusted Worker candidate patch"))).toContain("steps.worker_contract.outputs.prompt");
    expect(workflow).toContain("openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e");
  });

  it("marks the model boundary and persists history from the isolated issue-write job", () => {
    expect(workflow.indexOf("Mark Worker strategy attempt start")).toBeLessThan(workflow.indexOf("Run one bounded implementation Worker"));
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
      `- Dependency paths: \`${JSON.stringify([...basePacket.dependency_paths].sort())}\``,
      `- Evidence fingerprint: \`${descriptor.evidence_fingerprint}\``,
      `- Strategy fingerprint: \`${descriptor.strategy_fingerprint}\``,
      "- State: `DISPATCH_STARTED`",
    ].join("\n");
    expect(parseWorkerStrategyDispatchStarts([{
      user: {login: "github-actions[bot]", type: "Bot"},
      body,
    }])).toEqual([dispatchStart(basePacket, 20, 1)]);
  });
  it("keeps legacy missing dependency metadata fail-closed and rejects noncanonical metadata", () => {
    const descriptor = workerStrategyDescriptor(basePacket);
    const baseLines = [
      "<!-- proffera-worker-dispatch-start:B4-WORKER-1:20 -->",
      "<!-- proffera-worker-strategy-start:v1:B4-WORKER-1:20 -->",
      "- Task ID: `B4-WORKER-1`",
      "- GitHub Run ID: `20`",
      "- Run Attempt: `1`",
      `- Baseline SHA: \`${basePacket.base_sha}\``,
      `- Evidence fingerprint: \`${descriptor.evidence_fingerprint}\``,
      `- Strategy fingerprint: \`${descriptor.strategy_fingerprint}\``,
      "- State: `DISPATCH_STARTED`",
    ];
    expect(parseWorkerStrategyDispatchStarts([{
      user: {login: "github-actions[bot]", type: "Bot"},
      body: baseLines.join("\n"),
    }])[0].dependency_paths).toEqual([]);

    const noncanonical = [...baseLines];
    noncanonical.splice(6, 0, "- Dependency paths: `[\"src/z.ts\",\"src/a.ts\"]`");
    expect(() => parseWorkerStrategyDispatchStarts([{
      user: {login: "github-actions[bot]", type: "Bot"},
      body: noncanonical.join("\n"),
    }])).toThrow("not canonical");
  });

  it("keeps write authority out of the model-executing dispatch job", () => {
    const dispatch = workflow.slice(workflow.indexOf("  dispatch:"), workflow.indexOf("  publish:"));
    expect(dispatch).toContain("issues: read");
    expect(dispatch).not.toContain("issues: write");
  });
});
