import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, memoryIdentity, mergeObservation } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { ciAutofixAdmittedFailures, ciAutofixFailureDetailDigest, ciAutofixSourceFailures, classifyCiAutofixOutcome, CI_AUTOFIX_EXECUTION_CONTRACT, CI_AUTOFIX_EXECUTION_PROMPT, ciAutofixMemoryState, ciAutofixObservation, ciAutofixRecoveryBody, ciAutofixStartBody, ciAutofixStrategyDescriptor, ciAutofixTerminalBody, decideCiAutofixStrategyHistory, parseCiAutofixStarts, parseCiAutofixTerminals, prepareCiAutofixOutcome, prepareCiAutofixTerminal, prepareCiAutofixTerminalBackfill, prepareCiAutofixTerminalFromStart, proveCiAutofixIndeterminateRecovery, proveCiAutofixModelNotLaunched, proveCiAutofixPrelaunchRecovery, unresolvedCiAutofixStarts } from "../scripts/supervisor-ci-autofix-strategy-memory.mjs";

const repository = "ibboabdoli-ai/Proffera";
const pr = 934;
const head = "a".repeat(40);
const failures = [
  {job: "Validate", steps: ["Require all scope-selected quality checks"]},
  {job: "Unit and worker tests", steps: ["Test"]},
];

function trustedComment(body: string, id = 1) {
  return {
    id,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
    user: {login: "github-actions[bot]", type: "Bot"},
    body,
  };
}
function start({
  attemptHead = head,
  failureSet = failures,
  run_id = 50,
  run_attempt = 1,
  source_run_id = 40,
  source_run_attempt = 1,
}: {
  attemptHead?: string;
  failureSet?: Array<{job: string; steps: string[]}>;
  run_id?: number;
  run_attempt?: number;
  source_run_id?: number;
  source_run_attempt?: number;
} = {}) {
  const descriptor = ciAutofixStrategyDescriptor({pr_number: pr, head: attemptHead, failures: failureSet});
  return {
    pr_number: pr, run_id, run_attempt, source_run_id, source_run_attempt, head: attemptHead,
    failure_digest: descriptor.failure_digest,
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
  };
}
function record(outcome: "failed" | "no_change" | "cancelled" | "succeeded", {
  attemptHead = head,
  failureSet = failures,
  run_id = 50,
  run_attempt = 1,
}: {
  attemptHead?: string;
  failureSet?: Array<{job: string; steps: string[]}>;
  run_id?: number;
  run_attempt?: number;
} = {}) {
  const memory = createMemory(repository, {kind: "pull_request", pr_number: pr});
  return mergeObservation(
    {comment_id: null, memory},
    memoryIdentity({comment_id: null, memory}),
    ciAutofixObservation({
      repository, pr_number: pr, head: attemptHead, failures: failureSet, outcome,
      run_id, run_attempt, observed_at: "2026-10-05T18:00:00Z",
    }),
  ).memory.records[0];
}

describe("CI Autofix stable evidence and strategy identity", () => {
  it("normalizes failure ordering and duplicate failed steps", () => {
    const a = ciAutofixStrategyDescriptor({
      pr_number: pr, head,
      failures: [
        {job: "Unit and worker tests", steps: ["Test", "Test"]},
        {job: "Validate", steps: ["Require all scope-selected quality checks"]},
      ],
    });
    const b = ciAutofixStrategyDescriptor({pr_number: pr, head, failures});
    expect(a.failures).toEqual(b.failures);
    expect(a.failure_digest).toBe(b.failure_digest);
    expect(a.evidence_fingerprint).toBe(b.evidence_fingerprint);
    expect(a.strategy_fingerprint).toBe(b.strategy_fingerprint);
  });

  it("changes evidence on a new exact head or material failed-step snapshot", () => {
    const current = ciAutofixStrategyDescriptor({pr_number: pr, head, failures});
    const newHead = ciAutofixStrategyDescriptor({pr_number: pr, head: "b".repeat(40), failures});
    const newFailure = ciAutofixStrategyDescriptor({
      pr_number: pr, head, failures: [{job: "Build", steps: ["Build"]}],
    });
    expect(newHead.evidence_fingerprint).not.toBe(current.evidence_fingerprint);
    expect(newFailure.evidence_fingerprint).not.toBe(current.evidence_fingerprint);
    expect(newHead.strategy_fingerprint).toBe(current.strategy_fingerprint);
  });

  it("binds strategy identity to the exact execution contract", () => {
    const current = ciAutofixStrategyDescriptor({pr_number: pr, head, failures});
    const changed = ciAutofixStrategyDescriptor(
      {pr_number: pr, head, failures},
      {...CI_AUTOFIX_EXECUTION_CONTRACT, prompt_version: "ci_autofix_v2",
        prompt: CI_AUTOFIX_EXECUTION_PROMPT + "\nDifferent bounded strategy."},
    );
    expect(changed.evidence_fingerprint).toBe(current.evidence_fingerprint);
    expect(changed.strategy_fingerprint).not.toBe(current.strategy_fingerprint);
  });


});

describe("CI Autofix durable admission and outcomes", () => {
  it("allows the first deterministic failure snapshot", () => {
    expect(decideCiAutofixStrategyHistory({pr_number: pr, head, failures, records: [], starts: []}))
      .toMatchObject({decision: "ALLOW", prior_attempts: 0});
  });

  it.each(["failed", "no_change", "cancelled", "succeeded"] as const)(
    "suppresses unchanged evidence after a durable %s model attempt",
    (outcome) => {
      expect(decideCiAutofixStrategyHistory({
        pr_number: pr, head, failures, records: [record(outcome)], starts: [start()],
      })).toMatchObject({decision: "SUPPRESS_REPEAT", prior_attempts: 1});
    },
  );

  it("blocks changed evidence while any CI Autofix start for the PR is unresolved", () => {
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures, records: [],
      starts: [start({attemptHead: "b".repeat(40), failureSet: [{job: "Build", steps: ["Build"]}]})],
    })).toMatchObject({decision: "SUPPRESS_UNRESOLVED_ATTEMPT", unresolved_attempts: 1});
  });

  it("allows materially changed exact-head failure evidence after a durable prior attempt", () => {
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head: "b".repeat(40), failures,
      records: [record("failed")], starts: [start()],
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", prior_attempts: 1});
  });

  it("recovers only an authenticated terminal run where the model definitely did not launch", () => {
    const input = {
      repository, pr_number: pr, start: start(),
      run: {
        id: 50, run_attempt: 1, head_sha: "f".repeat(40), head_branch: "main",
        event: "workflow_run", path: ".github/workflows/proffera-ci-autofix.yml",
        name: "Proffera CI autofix", status: "completed", conclusion: "failure",
      },
    };
    const admit = {name: "Admit one bounded CI autofix strategy", status: "completed", conclusion: "success"};
    expect(proveCiAutofixPrelaunchRecovery({...input, jobs: [admit]}))
      .toEqual({recoverable: true, reason: "autofix_job_absent"});
    expect(proveCiAutofixPrelaunchRecovery({...input, jobs: [admit, {
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure",
      steps: [],
    }]})).toEqual({recoverable: true, reason: "model_step_absent"});
    expect(proveCiAutofixPrelaunchRecovery({...input, jobs: [admit, {
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure",
      steps: [
        {name: "Revalidate exact failed head before model", status: "completed", conclusion: "failure"},
        {name: "Run one bounded Codex repair attempt", status: "completed", conclusion: "skipped"},
      ],
    }]})).toEqual({recoverable: true, reason: "model_step_skipped"});
    expect(proveCiAutofixPrelaunchRecovery({...input, jobs: [admit, {
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure",
      steps: [{name: "Run one bounded Codex repair attempt", status: "completed", conclusion: "failure"}],
    }]})).toEqual({recoverable: false, reason: "autofix_job_may_have_launched"});
  });

  it("classifies authenticated absent or skipped model steps as pre-model without guessing launched work", () => {
    expect(proveCiAutofixModelNotLaunched({jobs: []}))
      .toEqual({recoverable: true, reason: "autofix_job_absent"});
    expect(proveCiAutofixModelNotLaunched({jobs: [{
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure", steps: [],
    }]})).toEqual({recoverable: true, reason: "model_step_absent"});
    expect(proveCiAutofixModelNotLaunched({jobs: [{
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "cancelled", steps: [],
    }]})).toEqual({recoverable: true, reason: "model_step_absent"});
    expect(proveCiAutofixModelNotLaunched({jobs: [{
      name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure",
      steps: [{name: "Run one bounded Codex repair attempt", status: "completed", conclusion: "success"}],
    }]})).toEqual({recoverable: false, reason: "model_step_may_have_launched"});
  });

  it("turns a terminal post-model orphan into outcome unknown without claiming success or failure", () => {
    const input = {
      repository, pr_number: pr, start: start(),
      run: {
        id: 50, run_attempt: 1, head_sha: "f".repeat(40), head_branch: "main",
        event: "workflow_run", path: ".github/workflows/proffera-ci-autofix.yml",
        name: "Proffera CI autofix", status: "completed", conclusion: "failure",
        updated_at: "2026-10-05T18:01:00Z",
      },
      jobs: [
        {name: "Admit one bounded CI autofix strategy", status: "completed", conclusion: "success"},
        {name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure",
          steps: [{name: "Run one bounded Codex repair attempt", status: "completed", conclusion: "success"}]},
      ],
    };
    expect(proveCiAutofixIndeterminateRecovery(input)).toEqual({
      recoverable: true, reason: "model_outcome_unknown", outcome: "unknown", observed_at: "2026-10-05T18:01:00Z",
    });
    expect(proveCiAutofixIndeterminateRecovery({
      ...input,
      jobs: [
        input.jobs[0],
        {name: "Bounded Codex CI autofix", status: "completed", conclusion: "failure", steps: []},
      ],
    })).toEqual({recoverable: false, reason: "model_not_launched"});
  });

  it("keeps unknown historical evidence suppressed while allowing materially changed evidence", () => {
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "unknown", observed_at: "2026-10-05T18:01:00Z",
    });
    const state = ciAutofixMemoryState({
      repository, pr_number: pr,
      comments: [
        trustedComment(ciAutofixStartBody({
          repository, pr_number: pr, head, failures,
          source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
        }), 10),
        trustedComment(terminalBody, 11),
      ],
    });
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures, records: state.records, starts: state.starts, terminals: state.terminals,
    })).toMatchObject({decision: "SUPPRESS_REPEAT", unresolved_attempts: 0});
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head: "b".repeat(40), failures,
      records: state.records, starts: state.starts, terminals: state.terminals,
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", unresolved_attempts: 0});
  });

  it("removes a proven pre-model orphan", () => {
    const comments = [
      trustedComment(ciAutofixStartBody({
        repository, pr_number: pr, head, failures,
        source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      }), 10),
      trustedComment(ciAutofixRecoveryBody({
        repository, pr_number: pr, start: start(), recovered_by_run_id: 51, recovered_by_run_attempt: 1,
      }), 11),
    ];
    const state = ciAutofixMemoryState({repository, pr_number: pr, comments});
    expect(state.starts).toEqual([]);
    expect(state.recoveries).toHaveLength(1);
    expect(unresolvedCiAutofixStarts({repository, pr_number: pr, comments})).toEqual([]);
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures, records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW"});
  });

  it("keeps historical terminal fingerprints valid across strategy contract updates", () => {
    const current = ciAutofixStrategyDescriptor({pr_number: pr, head, failures});
    const historical = ciAutofixStrategyDescriptor(
      {pr_number: pr, head, failures},
      {
        ...CI_AUTOFIX_EXECUTION_CONTRACT,
        prompt_version: "ci_autofix_v0",
        prompt: CI_AUTOFIX_EXECUTION_PROMPT + "\nHistorical bounded strategy.",
      },
    );
    expect(historical.strategy_fingerprint).not.toBe(current.strategy_fingerprint);

    const startBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    }).replace(current.strategy_fingerprint, historical.strategy_fingerprint);
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed", observed_at: "2026-10-05T18:00:00Z",
    }).replace(current.strategy_fingerprint, historical.strategy_fingerprint);

    const state = ciAutofixMemoryState({
      repository, pr_number: pr,
      comments: [trustedComment(startBody, 10), trustedComment(terminalBody, 11)],
    });
    expect(state.terminals[0].strategy_fingerprint).toBe(historical.strategy_fingerprint);
    const backfill = prepareCiAutofixTerminalBackfill({
      repository, pr_number: pr, comments: [trustedComment(startBody, 10), trustedComment(terminalBody, 11)],
    });
    expect(backfill).toMatchObject({unchanged: true, backfilled: 0, skipped_historical_strategy: 1});
    expect(JSON.parse(backfill.body.split("\n")[2]).records).toEqual([]);
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures, records: state.records, starts: state.starts, terminals: state.terminals,
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", prior_attempts: 1, unresolved_attempts: 0});
  });

  it("synthesizes recovered terminals with the historical start strategy instead of the current contract", () => {
    const current = ciAutofixStrategyDescriptor({pr_number: pr, head, failures});
    const historical = ciAutofixStrategyDescriptor(
      {pr_number: pr, head, failures},
      {
        ...CI_AUTOFIX_EXECUTION_CONTRACT,
        prompt_version: "ci_autofix_v0",
        prompt: CI_AUTOFIX_EXECUTION_PROMPT + "\nHistorical bounded strategy.",
      },
    );
    const historicalStartBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    }).replace(current.strategy_fingerprint, historical.strategy_fingerprint);
    const historicalStart = parseCiAutofixStarts(
      [trustedComment(historicalStartBody, 10)], {repository, pr_number: pr},
    )[0];

    const prepared = prepareCiAutofixTerminalFromStart({
      repository, pr_number: pr, start: historicalStart, failures,
      outcome: "unknown", observed_at: "2026-10-05T18:01:00Z", comments: [],
    });
    expect(prepared.terminal).toMatchObject({
      strategy_fingerprint: historical.strategy_fingerprint,
      evidence_fingerprint: historicalStart.evidence_fingerprint,
      failure_digest: historicalStart.failure_digest,
      outcome: "unknown",
    });
    const parsed = parseCiAutofixTerminals(
      [trustedComment(prepared.body, 11)], {repository, pr_number: pr},
    );
    expect(parsed[0].strategy_fingerprint).toBe(historical.strategy_fingerprint);
  });

  it("keeps terminal attempts resolved after bounded Failure Memory history is pruned", () => {
    const startBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    });
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed", observed_at: "2026-10-05T18:00:00Z",
    });
    const comments = [trustedComment(startBody, 10), trustedComment(terminalBody, 11)];
    const state = ciAutofixMemoryState({repository, pr_number: pr, comments});
    expect(state.records).toEqual([]);
    expect(state.terminals).toHaveLength(1);
    expect(unresolvedCiAutofixStarts({repository, pr_number: pr, comments})).toEqual([]);
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures, records: state.records, starts: state.starts, terminals: state.terminals,
    })).toMatchObject({decision: "SUPPRESS_REPEAT", prior_attempts: 1, unresolved_attempts: 0});
  });

  it("persists the first terminal tombstone idempotently and rejects conflicting attempt bindings", () => {
    const input = {
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed" as const, observed_at: "2026-10-05T18:00:00Z", comments: [] as ReturnType<typeof trustedComment>[],
    };
    const first = prepareCiAutofixTerminal(input);
    expect(first.unchanged).toBe(false);
    const comments = [trustedComment(first.body, 11)];
    const retry = prepareCiAutofixTerminal({...input, outcome: "succeeded", observed_at: "2026-10-05T18:05:00Z", comments});
    expect(retry.unchanged).toBe(true);
    expect(retry.terminal.outcome).toBe("failed");
    expect(parseCiAutofixTerminals(comments, {repository, pr_number: pr})).toHaveLength(1);
    expect(() => prepareCiAutofixTerminal({...input, head: "b".repeat(40), comments})).toThrow(/terminal_attempt_conflict/);
  });

  it("restores a pruned canonical record from the durable terminal outcome rather than a changed retry result", () => {
    const startBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    });
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed", observed_at: "2026-10-05T18:00:00Z",
    });
    const restored = prepareCiAutofixOutcome({
      repository, pr_number: pr, head, failures, source_run_id: 40, source_run_attempt: 1,
      run_id: 50, run_attempt: 1, outcome: "succeeded", observed_at: "2026-10-05T18:05:00Z",
      comments: [trustedComment(startBody, 10), trustedComment(terminalBody, 11)],
    });
    const memory = JSON.parse(restored.body.split("\n")[2]);
    expect(memory.records[0].outcome).toBe("failed");
    expect(memory.records[0].observations[0].first_seen).toBe("2026-10-05T18:00:00.000Z");
    expect(memory.records[0].observations[0].last_seen).toBe("2026-10-05T18:00:00.000Z");
  });

  it("backfills a terminal-only attempt into canonical Failure Memory without rerunning the model", () => {
    const startBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    });
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed", observed_at: "2026-10-05T18:00:00Z",
    });
    const initial = [trustedComment(startBody, 10), trustedComment(terminalBody, 11)];
    const first = prepareCiAutofixTerminalBackfill({repository, pr_number: pr, comments: initial});
    expect(first.unchanged).toBe(false);
    expect(first.backfilled).toBe(1);
    const memory = JSON.parse(first.body.split("\n")[2]);
    expect(memory.records).toHaveLength(1);
    expect(memory.records[0].outcome).toBe("failed");
    expect(memory.records[0].observations[0].source).toMatchObject({run_id: 50, attempt: 1});

    const persisted = [...initial, trustedComment(first.body, 12)];
    const second = prepareCiAutofixTerminalBackfill({repository, pr_number: pr, comments: persisted});
    expect(second.unchanged).toBe(true);
    expect(second.backfilled).toBe(0);
  });

  it("persists a started attempt idempotently and preserves the first terminal outcome", () => {
    const initial = [trustedComment(ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    }), 10)];
    const first = prepareCiAutofixOutcome({
      repository, pr_number: pr, head, failures, source_run_id: 40, source_run_attempt: 1,
      run_id: 50, run_attempt: 1, outcome: "failed", observed_at: "2026-10-05T18:00:00Z", comments: initial,
    });
    const persisted = [...initial, trustedComment(first.body, 11)];
    const retry = prepareCiAutofixOutcome({
      repository, pr_number: pr, head, failures, source_run_id: 40, source_run_attempt: 1,
      run_id: 50, run_attempt: 1, outcome: "succeeded", observed_at: "2026-10-05T18:05:00Z", comments: persisted,
    });
    expect(first.unchanged).toBe(false);
    expect(retry.unchanged).toBe(true);
    const memory = JSON.parse(first.body.split("\n")[2]);
    expect(memory.records).toHaveLength(1);
    expect(memory.records[0].outcome).toBe("failed");
    expect(memory.records[0].observations[0].source).toMatchObject({run_id: 50, attempt: 1});
  });

  it("ignores untrusted start markers", () => {
    const body = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    });
    expect(parseCiAutofixStarts([trustedComment(body)], {repository, pr_number: pr})).toEqual([start()]);
    expect(parseCiAutofixStarts([{
      ...trustedComment(body), user: {login: "ibboabdoli-ai", type: "User"},
    }], {repository, pr_number: pr})).toEqual([]);
  });

  it("ignores reserved marker records quoted inside unrelated bot comments", () => {
    const startBody = ciAutofixStartBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
    });
    const recoveryBody = ciAutofixRecoveryBody({
      repository, pr_number: pr, start: start(), recovered_by_run_id: 51, recovered_by_run_attempt: 1,
    });
    const terminalBody = ciAutofixTerminalBody({
      repository, pr_number: pr, head, failures,
      source_run_id: 40, source_run_attempt: 1, run_id: 50, run_attempt: 1,
      outcome: "failed", observed_at: "2026-10-05T18:00:00Z",
    });
    const embedded = [
      trustedComment("CI Autofix report:\n" + startBody, 20),
      trustedComment("CI Autofix report:\n" + recoveryBody, 21),
      trustedComment("CI Autofix report:\n" + terminalBody, 22),
    ];
    expect(parseCiAutofixStarts(embedded, {repository, pr_number: pr})).toEqual([]);
    expect(parseCiAutofixTerminals(embedded, {repository, pr_number: pr})).toEqual([]);
    expect(ciAutofixMemoryState({repository, pr_number: pr, comments: embedded})).toMatchObject({
      starts: [], recoveries: [], terminals: [],
    });
  });
});

describe("CI Autofix workflow accounting boundary", () => {
  type Concurrency = {group: string; queue?: "single" | "max"; "cancel-in-progress"?: boolean};
  type WorkflowStep = {name?: string; id?: string; run?: string; uses?: string; with?: Record<string, string>; env?: Record<string, string>};
  type WorkflowJob = {
    name?: string;
    concurrency?: Concurrency | string;
    permissions?: Record<string, string>;
    steps?: WorkflowStep[];
  };
  type Workflow = {jobs: Record<string, WorkflowJob>};

  const workflowText = readFileSync(
    new URL("../.github/workflows/proffera-ci-autofix.yml", import.meta.url),
    "utf8",
  ).replaceAll("\r\n", "\n");
  const yamlLoad = createRequire(import.meta.url)("js-yaml").load as (text: string) => Workflow;
  const workflow = yamlLoad(workflowText);
  const handoff = readFileSync(new URL("../scripts/supervisor-worker-handoff.mjs", import.meta.url), "utf8");
  const memoryGroup = "proffera-final-gate-memory-${{ fromJSON(needs.prepare.outputs.pr_number) }}";

  const job = (id: string) => {
    const value = workflow.jobs[id];
    if (!value) throw new Error(`Missing workflow job: ${id}`);
    return value;
  };
  const step = (jobId: string, name: string) => {
    const value = job(jobId).steps?.find((candidate) => candidate.name === name);
    if (!value) throw new Error(`Missing workflow step: ${jobId}/${name}`);
    return value;
  };
  const run = (jobId: string, name: string) => step(jobId, name).run ?? "";

  it("serializes admission and recording through the shared Failure Memory mutex", () => {
    expect(job("admit").concurrency).toEqual({
      group: memoryGroup,
      queue: "max",
      "cancel-in-progress": false,
    });
    expect(job("record").concurrency).toEqual({
      group: memoryGroup,
      queue: "max",
      "cancel-in-progress": false,
    });
    expect(job("admit").name).toBe("Admit one bounded CI autofix strategy");
    expect(job("record").name).toBe("Record durable CI Autofix attempt outcome");
  });

  it("keeps the model job outside issue-write authority and revalidates the exact head immediately before model execution", () => {
    const autofix = job("autofix");
    expect(autofix.permissions ?? {}).not.toHaveProperty("issues");
    const names = (autofix.steps ?? []).map((candidate) => candidate.name);
    const revalidate = names.indexOf("Revalidate exact failed head before model");
    const model = names.indexOf("Run one bounded Codex repair attempt");
    expect(revalidate).toBeGreaterThanOrEqual(0);
    expect(model).toBe(revalidate + 1);
  });

  it("uses exact source-run attempt evidence and classifies terminal outcomes only in the record job", () => {
    const admit = run("admit", "Recover proven pre-model starts and admit exact-head CI evidence");
    const capture = run("autofix", "Capture failed CI logs as untrusted input");
    const classify = run("record", "Classify the started CI Autofix model attempt");

    expect(admit).toContain("collect-failures");
    expect(admit).toContain('--arg source_run_attempt "$SOURCE_RUN_ATTEMPT"');
    expect(capture).toContain('gh run view "$RUN_ID" --repo "$REPOSITORY" --attempt "$RUN_ATTEMPT" --log-failed');
    expect(classify).toContain("classify-outcome");
    expect(classify).not.toContain("outcome=failed");
    expect(classify).toContain("actions/runs/$ADMITTED_RUN_ID/attempts/$ADMITTED_RUN_ATTEMPT/jobs?per_page=100");
  });

  it("recovers post-model bookkeeping loss as unknown and backfills terminal-only accounting before admission", () => {
    const admit = run("admit", "Recover proven pre-model starts and admit exact-head CI evidence");
    expect(admit).toContain("indeterminate-proof");
    expect(admit).toContain('--arg outcome "$(jq -r \'.outcome\' <<< "$indeterminate")"');
    expect(admit).toContain("prepare-terminal-from-start");
    expect(admit).not.toContain("test \"$(jq -r '.terminal.strategy_fingerprint'");
    expect(admit).toContain("apply_terminal_backfill");
    expect(admit.indexOf("indeterminate-proof")).toBeLessThan(admit.lastIndexOf("apply_terminal_backfill"));
  });

  it("backfills terminal-only accounting before admission and classifies pre-model startup failures without charging history", () => {
    const admit = run("admit", "Recover proven pre-model starts and admit exact-head CI evidence");
    const classify = run("record", "Classify the started CI Autofix model attempt");
    expect(admit).toContain("backfill-terminals");
    expect(admit.indexOf("backfill-terminals")).toBeLessThan(admit.indexOf(" unresolved <<<"));
    expect(classify).toContain("classify-outcome");
    expect(classify).not.toContain('model_steps="$(jq');
  });

  it("persists terminal tombstones before bounded Failure Memory and treats publication as authoritative", () => {
    const persist = run("record", "Persist exact CI Autofix outcome in canonical Failure Memory");
    const classify = run("record", "Classify the started CI Autofix model attempt");
    expect(persist).toContain("prepare-terminal");
    const terminalIndex = persist.indexOf(
      'terminal_plan="$(node scripts/supervisor-ci-autofix-strategy-memory.mjs prepare-terminal',
    );
    const firstOutcomePlanIndex = persist.indexOf(
      'plan_a="$RUNNER_TEMP/proffera-ci-autofix-plan-a.json"',
    );
    expect(terminalIndex).toBeGreaterThanOrEqual(0);
    expect(firstOutcomePlanIndex).toBeGreaterThan(terminalIndex);
    expect(classify).toContain('--arg published "$PUBLISHED"');
    const publish = run("autofix", "Publish validated repair");
    expect(publish.trim().split("\n").at(-1)).toBe('echo "published=yes" >> "$GITHUB_OUTPUT"');
    expect(publish.indexOf('git -c core.hooksPath=')).toBeLessThan(publish.indexOf('echo "published=yes"'));
    expect(publish.slice(publish.indexOf('git -c core.hooksPath='))).not.toContain('gh api');
    expect(run("autofix", "Verify and report published repair")).not.toContain("git push");
  });

  it("aligns every explicit action input and action-default model with the canonical strategy", () => {
    const model = step("autofix", "Run one bounded Codex repair attempt");
    expect(model.uses).toBe(`openai/codex-action@${CI_AUTOFIX_EXECUTION_CONTRACT.action_revision}`);
    expect(model.with).toEqual({
      "openai-api-key": "${{ secrets." + CI_AUTOFIX_EXECUTION_CONTRACT.api_key_source + " }}",
      "permission-profile": CI_AUTOFIX_EXECUTION_CONTRACT.permission_profile,
      "safety-strategy": CI_AUTOFIX_EXECUTION_CONTRACT.safety_strategy,
      "allow-bot-users": CI_AUTOFIX_EXECUTION_CONTRACT.allow_bot_users,
      effort: CI_AUTOFIX_EXECUTION_CONTRACT.effort,
      prompt: CI_AUTOFIX_EXECUTION_PROMPT + "\n",
    });
    expect(CI_AUTOFIX_EXECUTION_CONTRACT.model).toBe("action-default");
    expect(model.with).not.toHaveProperty("model");
  });

  it.each(["api_failure", "poll_mismatch"])("keeps a successful push authoritative after %s and refuses a stale publication", (failure) => {
    const dir = mkdtempSync(join(tmpdir(), "ci-autofix-publication-"));
    try {
      const output = join(dir, "output");
      const calls = join(dir, "pushes");
      writeFileSync(join(dir, "git"), `#!/bin/bash
if [ "$1" = rev-parse ]; then
  if [ "$2" = HEAD ]; then echo "$NEW_HEAD"; else echo "$EXPECTED_HEAD"; fi
elif [ "$1" = show ]; then echo "$EXPECTED_HEAD"
elif [ "$1" = -c ] && [ "$3" = push ]; then echo push >> "$PUSH_CALLS"; fi
`, {mode: 0o755});
      writeFileSync(join(dir, "gh"), `#!/bin/bash
if [ "$PHASE" = report ]; then
  if [ "$FAILURE" = api_failure ]; then exit 1; fi
  echo stale
elif [[ "$2" == */actions/runs/* ]]; then
  jq -n --arg head "$EXPECTED_HEAD" '{id:40,run_attempt:1,head_sha:$head,status:"completed",conclusion:"failure"}'
else
  jq -n --arg head "$LIVE_HEAD" --arg ref "$HEAD_REF" '{head:{sha:$head,ref:$ref}}'
fi
`, {mode: 0o755});
      writeFileSync(join(dir, "sleep"), "#!/bin/bash\nexit 0\n", {mode: 0o755});
      const env = {...process.env, PATH: dir + ":" + process.env.PATH, GITHUB_OUTPUT: output,
        RUNNER_TEMP: dir, PUSH_CALLS: calls, EXPECTED_HEAD: head, NEW_HEAD: "b".repeat(40), LIVE_HEAD: head,
        GITHUB_RUN_ID: "50", GITHUB_RUN_ATTEMPT: "1", ADMITTED_RUN_ID: "50", ADMITTED_RUN_ATTEMPT: "1",
        SOURCE_RUN_ID: "40", SOURCE_RUN_ATTEMPT: "1", HEAD_REF: "work/proffera-example", PR_NUMBER: "934", REPOSITORY: repository,
        PUSH_TOKEN: "fixture", FAILURE: failure};
      const publish = spawnSync("bash", ["-c", run("autofix", "Publish validated repair")], {env, encoding: "utf8"});
      expect(publish.status, publish.stderr).toBe(0);
      expect(readFileSync(output, "utf8")).toContain("published=yes");
      const report = spawnSync("bash", ["-c", run("autofix", "Verify and report published repair")], {
        env: {...env, PHASE: "report"}, encoding: "utf8",
      });
      expect(report.status).not.toBe(0);
      expect(readFileSync(output, "utf8")).toContain("published=yes");
      expect(readFileSync(calls, "utf8")).toBe("push\n");
      const stale = spawnSync("bash", ["-c", run("autofix", "Publish validated repair")], {
        env: {...env, LIVE_HEAD: "c".repeat(40)}, encoding: "utf8",
      });
      expect(stale.status).not.toBe(0);
      expect(readFileSync(calls, "utf8")).toBe("push\n");
    } finally { rmSync(dir, {recursive: true, force: true}); }
  });

  it("rejects branch rewinds/deletion before advertisement and ref movement after advertisement without force", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-autofix-cas-"));
    try {
      const remote = join(dir, "remote.git");
      const repo = join(dir, "repo");
      const hooks = join(dir, "hooks");
      mkdirSync(repo); mkdirSync(hooks);
      const git = (args: string[], cwd = repo) => {
        const result = spawnSync("git", args, {cwd, encoding: "utf8"});
        expect(result.status, result.stderr).toBe(0);
        return result.stdout.trim();
      };
      git(["init", "--bare", "-q", remote]);
      git(["init", "-q"]);
      git(["config", "user.name", "Fixture"]); git(["config", "user.email", "fixture@example.invalid"]);
      git(["config", "core.hooksPath", "/dev/null"]);
      writeFileSync(join(repo, "file"), "base"); git(["add", "file"]); git(["commit", "-qm", "base"]);
      const base = git(["rev-parse", "HEAD"]);
      writeFileSync(join(repo, "file"), "expected"); git(["commit", "-qam", "expected"]);
      const expected = git(["rev-parse", "HEAD"]);
      writeFileSync(join(repo, "file"), "candidate"); git(["commit", "-qam", "candidate"]);
      const candidate = git(["rev-parse", "HEAD"]);
      const ref = "refs/heads/work/proffera-fixture";
      git(["push", remote, candidate + ":" + ref]);
      const hook = run("autofix", "Publish validated repair").match(/<<'HOOK'\n([\s\S]*?)\nHOOK/);
      expect(hook).not.toBeNull();
      const env = {...process.env, NEW_HEAD: candidate, EXPECTED_HEAD: expected,
        HEAD_REF: "work/proffera-fixture", REMOTE_FIXTURE: remote, BASE_FIXTURE: base};
      const push = () => spawnSync("git", ["-c", "core.hooksPath=" + hooks, "push", remote, candidate + ":" + ref], {
        cwd: repo, env, encoding: "utf8",
      });
      writeFileSync(join(hooks, "pre-push"), hook![1] + "\n", {mode: 0o700});
      git(["--git-dir=" + remote, "update-ref", ref, base]);
      expect(push().status).not.toBe(0);
      expect(git(["--git-dir=" + remote, "rev-parse", ref])).toBe(base);
      git(["--git-dir=" + remote, "update-ref", "-d", ref]);
      expect(push().status).not.toBe(0);
      git(["--git-dir=" + remote, "update-ref", ref, expected]);
      writeFileSync(join(hooks, "pre-push"), hook![1] +
        '\ngit --git-dir="$REMOTE_FIXTURE" update-ref "refs/heads/$HEAD_REF" "$BASE_FIXTURE"\n', {mode: 0o700});
      expect(push().status).not.toBe(0);
      expect(git(["--git-dir=" + remote, "rev-parse", ref])).toBe(base);
      git(["--git-dir=" + remote, "update-ref", ref, expected]);
      writeFileSync(join(hooks, "pre-push"), hook![1] + "\n", {mode: 0o700});
      expect(push().status).toBe(0);
      expect(git(["--git-dir=" + remote, "rev-parse", ref])).toBe(candidate);
      expect(push().status).not.toBe(0); // no second publication, including a no-op
    } finally { rmSync(dir, {recursive: true, force: true}); }
  });

  it("rejects selective job reruns with cached admission and superseded source attempts before model execution", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-autofix-model-boundary-"));
    try {
      writeFileSync(join(dir, "gh"), `#!/bin/bash
if [[ "$2" == */actions/runs/* ]]; then
  jq -n --arg head "$LIVE_HEAD" --arg attempt "$LATEST_SOURCE_ATTEMPT" '{id:40,run_attempt:($attempt|tonumber),head_sha:$head,status:"completed",conclusion:"failure"}'
else echo "$LIVE_HEAD"; fi
`, {mode: 0o755});
      const env = {...process.env, PATH: dir + ":" + process.env.PATH, EXPECTED_HEAD: head, LIVE_HEAD: head,
        GITHUB_RUN_ID: "50", GITHUB_RUN_ATTEMPT: "1", ADMITTED_RUN_ID: "50", ADMITTED_RUN_ATTEMPT: "1",
        SOURCE_RUN_ID: "40", SOURCE_RUN_ATTEMPT: "1", LATEST_SOURCE_ATTEMPT: "1", REPOSITORY: repository, PR_NUMBER: "934"};
      const execute = (overrides: Record<string, string>) => spawnSync("bash", ["-c", run("autofix", "Revalidate exact failed head before model")], {
        env: {...env, ...overrides}, encoding: "utf8",
      });
      expect(execute({}).status).toBe(0);
      expect(execute({GITHUB_RUN_ATTEMPT: "2"}).status).not.toBe(0);
      expect(execute({GITHUB_RUN_ID: "51"}).status).not.toBe(0);
      expect(execute({LATEST_SOURCE_ATTEMPT: "2"}).status).not.toBe(0);
      expect(execute({LIVE_HEAD: "b".repeat(40)}).status).not.toBe(0);
      const guard = step("autofix", "Revalidate exact failed head before model");
      expect(guard.env?.ADMITTED_RUN_ATTEMPT).toBe("${{ needs.admit.outputs.admitted_run_attempt }}");
    } finally { rmSync(dir, {recursive: true, force: true}); }
  });

  it("protects the CI Autofix strategy helper from ordinary Worker scope", () => {
    expect(handoff).toContain('"scripts/supervisor-ci-autofix-strategy-memory.mjs"');
  });
});

describe("CI Autofix complete execution identity and bounded material evidence", () => {
  it.each([
    ["permission_profile", ":read-only"], ["safety_strategy", "different"],
    ["allow_bot_users", "another-bot"], ["action_revision", "b".repeat(40)],
    ["effort", "low"], ["prompt_version", "ci_autofix_next"],
    ["prompt", CI_AUTOFIX_EXECUTION_PROMPT + "\nChanged"], ["model", "explicit-model"],
    ["api_key_source", "ANOTHER_KEY"],
  ])("includes %s in strategy identity", (key, value) => {
    const input = {pr_number: pr, head, failures};
    expect(ciAutofixStrategyDescriptor(input, {...CI_AUTOFIX_EXECUTION_CONTRACT, [key]: value}).strategy_fingerprint)
      .not.toBe(ciAutofixStrategyDescriptor(input).strategy_fingerprint);
  });

  const material = "Error: assertion failed\nExpected: 12\nReceived: 13\n at tests/a.test.ts:42";
  it("removes volatile timestamps, ANSI, durations, progress, temp paths, transient IDs and error ordering", () => {
    const logs = [
      `2026-10-06T10:00:01.111Z \u001b[31m${material}\u001b[0m\n\nError: worker stopped\nelapsed 1.2s\n/tmp/12345678-abcd-1234-abcd-123456789012/test.ts request_id=abcdef1234567890\nprogress 20%`,
      `Error: worker stopped\nelapsed 98s\n/tmp/87654321-dcba-4321-dcba-210987654321/test.ts request_id=0987654321fedcba\nprogress 99%\n\n2026-10-07T11:00:02.222Z ${material}`,
    ];
    expect(ciAutofixFailureDetailDigest(logs[0])).toBe(ciAutofixFailureDetailDigest(logs[1]));
  });

  it("keeps a real Vitest footer independent of parallel error order", () => {
    const a = 'FAIL test A\nAssertionError: different value\nExpected: "a"\nReceived: "b"';
    const b = 'FAIL test B\nAssertionError: different value\nExpected: "c"\nReceived: "d"';
    const footer = '\nTest Files 2 failed (2)\nTests 2 failed (2)\n##[error]Process completed with exit code 1.';
    expect(ciAutofixFailureDetailDigest(a + "\n\n" + b + footer))
      .toBe(ciAutofixFailureDetailDigest(b + "\n\n" + a + footer));
  });

  it("ignores Vitest failed-file and failed-test duration suffixes", () => {
    const log = "❯ tests/foo.test.ts (2 tests | 1 failed) 17ms\n× foo > returns result 17ms\n\n" + material;
    expect(ciAutofixFailureDetailDigest(log)).toBe(ciAutofixFailureDetailDigest(log.replaceAll("17ms", "23ms")));
  });

  it.each(["expected", "Received", "AssertionError"])("keeps reporter titles containing %s out of assertion mode", (word) => {
    const log = `❯ tests/${word}.test.ts (2 tests | 1 failed) 17ms\n× math > returns ${word} result 17ms\n✓ math > handles ${word} 17ms\n\n${material}`;
    const failureSet = (value: string) => [{job: "Unit and worker tests", steps: ["Test"], detail_digest: ciAutofixFailureDetailDigest(value)}];
    const original = failureSet(log);
    const rerun = failureSet(log.replaceAll("17ms", "23ms"));
    expect(rerun).toEqual(original);
    expect(ciAutofixFailureDetailDigest(log.replace(`✓ math > handles ${word} 17ms\n`, ""))).toBe(original[0].detail_digest);
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures: rerun, records: [record("no_change", {failureSet: original})], starts: [],
    })).toMatchObject({decision: "SUPPRESS_REPEAT", prior_attempts: 1});
  });

  it("preserves interior blank assertion lines while ignoring inter-block separators", () => {
    const log = 'FAIL test A\nAssertionError: expected strings to match\nExpected: "a\n\nb"\nReceived: "different"';
    const transported = (value: string) => value.split("\n").map((line) => `2026-10-06T10:00:01.111Z ${line}`).join("\n");
    const failureSet = (value: string) => [{job: "Unit and worker tests", steps: ["Test"], detail_digest: ciAutofixFailureDetailDigest(transported(value))}];
    const original = failureSet(log);
    const changed = failureSet(log.replace('a\n\nb', 'a\nb'));
    expect(changed).not.toEqual(original);
    expect(decideCiAutofixStrategyHistory({
      pr_number: pr, head, failures: changed, records: [record("failed", {failureSet: original})], starts: [],
    })).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY", prior_attempts: 1});
    const next = 'FAIL test B\nAssertionError: expected 1 to equal 2\nExpected: 2\nReceived: 1';
    const footer = '\nTest Files 2 failed (2)\nTests 2 failed (2)';
    expect(ciAutofixFailureDetailDigest(transported(log + '\n' + next + footer)))
      .toBe(ciAutofixFailureDetailDigest(transported(next + '\n\n\n' + log + '\n\n' + footer)));
  });

  it("distinguishes material failures in the same step, including multiline expected/received swaps", () => {
    const first = ciAutofixFailureDetailDigest(material);
    expect(ciAutofixFailureDetailDigest(material.replace("Received: 13", "Received: 14"))).not.toBe(first);
    expect(ciAutofixFailureDetailDigest("Error: assertion failed\nExpected:\n12\nReceived:\n13"))
      .not.toBe(ciAutofixFailureDetailDigest("Error: assertion failed\nExpected:\n13\nReceived:\n12"));
    expect(ciAutofixFailureDetailDigest("FAIL test A\nError: assertion\nExpected: 1\nReceived: 2\nFAIL test B\nError: assertion\nExpected: 2\nReceived: 1"))
      .not.toBe(ciAutofixFailureDetailDigest("FAIL test A\nError: assertion\nExpected: 2\nReceived: 1\nFAIL test B\nError: assertion\nExpected: 1\nReceived: 2"));
    expect(ciAutofixFailureDetailDigest('Error: assertion failed\nExpected: "x"\nReceived: "a b"'))
      .not.toBe(ciAutofixFailureDetailDigest('Error: assertion failed\nExpected: "x"\nReceived: "a  b"'));
    expect(ciAutofixFailureDetailDigest('Error: assertion failed\nExpected: "elapsed 0s"\nReceived: "elapsed 1s"'))
      .not.toBe(ciAutofixFailureDetailDigest('Error: assertion failed\nExpected: "elapsed 0s"\nReceived: "elapsed 2s"'));
    expect(ciAutofixFailureDetailDigest("Error: expected progress 20%"))
      .not.toBe(ciAutofixFailureDetailDigest("Error: expected progress 99%"));
  });

  it("rejects unavailable, excessive, malformed or mixed evidence instead of hashing a truncated prefix", () => {
    expect(() => ciAutofixFailureDetailDigest("")).toThrow();
    expect(() => ciAutofixFailureDetailDigest("x".repeat(4 * 1024 * 1024 + 1))).toThrow();
    expect(() => ciAutofixFailureDetailDigest("Error: " + "x".repeat(2049))).toThrow();
    expect(() => ciAutofixFailureDetailDigest(Array.from({length: 257}, (_, i) => `Error: failure ${i}`).join("\n"))).toThrow();
    expect(() => ciAutofixStrategyDescriptor({pr_number: pr, head, failures: [
      failures[0], {...failures[1], detail_digest: "a".repeat(64)},
    ]})).toThrow("mixed_failure_versions");
  });

  function source(attempt = 1, log = material) {
    return {
      head, pr_number: pr, source_run_id: 40, source_run_attempt: attempt,
      run: {id: 40, run_attempt: attempt, head_sha: head, path: ".github/workflows/ci.yml",
        name: "CI", event: "pull_request", status: "completed", conclusion: "failure",
        pull_requests: [{number: pr, head: {sha: head, repo: {url: "https://api.github.com/repos/" + repository}}}]},
      jobs: [{id: 70 + attempt, run_id: 40, run_attempt: attempt, head_sha: head,
        status: "completed", conclusion: "failure", name: "Unit and worker tests",
        steps: [{name: "Test", conclusion: "failure"}]}],
      logs: {[70 + attempt]: log},
    };
  }

  it("binds source identity exactly while identical rerun failures retain the material evidence identity", () => {
    const first = ciAutofixSourceFailures(source());
    const rerun = ciAutofixSourceFailures(source(2));
    expect(first).toEqual(rerun);
    const input = {pr_number: pr, head, failures: first};
    const fingerprint = ciAutofixStrategyDescriptor(input).evidence_fingerprint;
    const different = ciAutofixSourceFailures(source(2, "Error: infrastructure unavailable"));
    expect(ciAutofixStrategyDescriptor({...input, failures: different}).evidence_fingerprint).not.toBe(fingerprint);
    for (const invalid of [
      {...source(), pr_number: pr + 1}, {...source(), source_run_id: 41}, {...source(), source_run_attempt: 2},
      {...source(), head: "b".repeat(40)}, {...source(), jobs: source(2).jobs},
      {...source(), logs: {}}, {...source(), run: {...source().run, event: "push"}},
    ]) expect(() => ciAutofixSourceFailures(invalid)).toThrow();
  });

  it("retains bounded admitted evidence through orphan recovery, terminal pruning and exact-attempt recording", () => {
    const detailed = ciAutofixSourceFailures(source());
    const input = {repository, pr_number: pr, head, failures: detailed,
      run_id: 50, run_attempt: 2, source_run_id: 40, source_run_attempt: 1};
    const comments = [trustedComment(ciAutofixStartBody(input), 10)];
    const original = parseCiAutofixStarts(comments, input)[0];
    expect(original.failures).toEqual(detailed);
    expect(ciAutofixAdmittedFailures({...input, comments})).toEqual(detailed);
    expect(() => ciAutofixAdmittedFailures({...input, run_attempt: 1, comments})).toThrow();
    const terminal = prepareCiAutofixTerminalFromStart({...input, start: original, comments,
      outcome: "unknown", observed_at: "2026-10-06T12:00:00Z"});
    comments.push(trustedComment(terminal.body, 11));
    const state = ciAutofixMemoryState({...input, comments});
    expect(unresolvedCiAutofixStarts({...input, comments})).toEqual([]);
    expect(decideCiAutofixStrategyHistory({...input, ...state})).toMatchObject({decision: "SUPPRESS_REPEAT"});
    expect(prepareCiAutofixTerminalBackfill({...input, comments})).toMatchObject({backfilled: 1});
    const recovery = ciAutofixRecoveryBody({...input, start: original, recovered_by_run_id: 51, recovered_by_run_attempt: 1});
    expect(ciAutofixMemoryState({...input, comments: [comments[0], trustedComment(recovery, 12)]}).starts).toEqual([]);
    const altered = comments[0].body.replace(detailed[0].detail_digest, "0".repeat(64));
    expect(() => parseCiAutofixStarts([trustedComment(altered)], input)).toThrow("start_evidence_binding");
  });

  it("fetches only jobs/logs authenticated to the exact source run attempt", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-autofix-source-"));
    try {
      const fixture = source(2);
      writeFileSync(join(dir, "run.json"), JSON.stringify(fixture.run));
      writeFileSync(join(dir, "jobs.json"), JSON.stringify([{total_count: 1, jobs: fixture.jobs}]));
      writeFileSync(join(dir, "gh"), `#!/bin/bash
printf '%s\\n' "$*" >> "$FIXTURE_DIR/calls"
case "$2" in
  repos/ibboabdoli-ai/Proffera/actions/runs/40) cat "$FIXTURE_DIR/run.json";;
  repos/ibboabdoli-ai/Proffera/actions/runs/40/attempts/2) cat "$FIXTURE_DIR/run.json";;
  repos/ibboabdoli-ai/Proffera/actions/runs/40/attempts/2/jobs?per_page=100) cat "$FIXTURE_DIR/jobs.json";;
  repos/ibboabdoli-ai/Proffera/actions/jobs/72/logs) echo 'Error: assertion failed';;
  *) exit 4;;
esac
`, {mode: 0o755});
      const input = JSON.stringify({repository, pr_number: pr, head, source_run_id: 40, source_run_attempt: 2});
      const invoke = () => spawnSync(process.execPath, ["scripts/supervisor-ci-autofix-strategy-memory.mjs", "collect-failures"], {
        input, encoding: "utf8", env: {...process.env, PATH: dir + ":" + process.env.PATH, FIXTURE_DIR: dir},
      });
      const result = invoke();
      expect(result.status, JSON.stringify(result)).toBe(0);
      expect(JSON.parse(result.stdout)).toHaveLength(1);
      const calls = readFileSync(join(dir, "calls"), "utf8");
      expect(calls).toContain("/attempts/2/jobs?per_page=100 --paginate --slurp");
      expect(calls).toContain("/jobs/72/logs");
      writeFileSync(join(dir, "jobs.json"), JSON.stringify([{total_count: 2, jobs: fixture.jobs}]));
      expect(invoke().stderr).toContain("source_jobs_incomplete");
      writeFileSync(join(dir, "jobs.json"), JSON.stringify([{total_count: 1, jobs: source(1).jobs}]));
      expect(invoke().stderr).toContain("source_job_binding");
      expect(readFileSync(join(dir, "calls"), "utf8")).not.toContain("/jobs/71/logs");
    } finally { rmSync(dir, {recursive: true, force: true}); }
  });
});

describe("CI Autofix truthful terminal outcomes", () => {
  const modelName = "Run one bounded Codex repair attempt";
  const step = (name: string, conclusion: string) => ({name, status: "completed", conclusion});
  const jobs = (conclusion: string, steps: Array<ReturnType<typeof step>>) => [{
    name: "Bounded Codex CI autofix", status: "completed", conclusion, steps,
  }];
  it.each(["failure", "cancelled", "timed_out", "startup_failure"])("retires an authenticated %s before model execution without a model charge", (conclusion) => {
    expect(classifyCiAutofixOutcome({jobs: jobs(conclusion, [])})).toMatchObject({persist: false});
    expect(classifyCiAutofixOutcome({jobs: jobs(conclusion, [step(modelName, "skipped")])})).toMatchObject({persist: false});
  });
  it("retires skipped jobs but fails closed for missing, running or contradictory evidence", () => {
    expect(classifyCiAutofixOutcome({jobs: jobs("skipped", [])})).toMatchObject({persist: false});
    for (const ambiguous of [
      [{name: "Bounded Codex CI autofix", status: "completed", conclusion: "timed_out"}],
      [{...jobs("timed_out", [step(modelName, "success")])[0], status: "in_progress"}],
      jobs("skipped", [step(modelName, "success")]),
      jobs("timed_out", [step("Validate bounded repair without repository token", "success")]),
      jobs("timed_out", [step(modelName, "skipped"), step(modelName, "success")]),
    ]) expect(() => classifyCiAutofixOutcome({jobs: ambiguous})).toThrow();
  });
  it.each(["failure", "cancelled", "timed_out"])("records post-model %s as unknown without a proven result", (conclusion) => {
    expect(classifyCiAutofixOutcome({jobs: jobs(conclusion, [step(modelName, "success")])}))
      .toEqual({persist: true, outcome: "unknown"});
    expect(classifyCiAutofixOutcome({jobs: jobs(conclusion, [step(modelName, "cancelled")])}))
      .toEqual({persist: true, outcome: "unknown"});
  });
  it("accepts only proven model failure, no-change or successful publication", () => {
    expect(classifyCiAutofixOutcome({jobs: jobs("failure", [step(modelName, "failure")])}))
      .toEqual({persist: true, outcome: "failed"});
    const noChange = jobs("success", [step(modelName, "success"), step("Validate bounded repair without repository token", "success")]);
    expect(classifyCiAutofixOutcome({jobs: noChange, changed: "no"})).toEqual({persist: true, outcome: "no_change"});
    expect(classifyCiAutofixOutcome({jobs: noChange})).toEqual({persist: true, outcome: "unknown"});
    expect(classifyCiAutofixOutcome({jobs: jobs("cancelled", [step(modelName, "success")]), published: "yes"}))
      .toEqual({persist: true, outcome: "succeeded"});
    expect(classifyCiAutofixOutcome({jobs: jobs("failure", [step(modelName, "success"), step("Publish validated repair", "success"),
      step("Verify and report published repair", "failure")])})).toEqual({persist: true, outcome: "succeeded"});
  });
});

describe("CI Autofix historical v1 wire compatibility", () => {
  it("reads real pre-repair fingerprints without upgrading S1 evidence or strategy to S2", () => {
    // Captured from the helper at PR head 88ef75afaa5dc092a73d1484077dbce6f2663f76.
    const legacy = {evidence_fingerprint: "109160a9c8a8cf089b15859d8d6f5ab16c6222a1449090f7333f873fd534458a",
      failure_digest: "806a09f4a6a96f70791efdd72af44490532de55bca281214dc03675cb6ca1436",
      head, pr_number: pr, run_attempt: 1, run_id: 50, source_run_attempt: 1, source_run_id: 40,
      strategy_fingerprint: "e6bee8b98fb723500efffea1eda9b02932a2eafb343afdbe636847f408f04549"};
    const startBody = `<!-- proffera-ci-autofix-start:v1:934:50:1 -->\n\`\`\`json\n${JSON.stringify(legacy)}\n\`\`\``;
    const terminalPayload = {evidence_fingerprint: legacy.evidence_fingerprint, failure_digest: legacy.failure_digest,
      failures: [{job: "Test", steps: ["Test"]}], head, observed_at: "2026-10-05T18:00:00Z", outcome: "failed",
      pr_number: pr, run_attempt: 1, run_id: 50, source_run_attempt: 1, source_run_id: 40,
      strategy_fingerprint: legacy.strategy_fingerprint};
    const terminalBody = `<!-- proffera-ci-autofix-terminal:v1:934:50:1 -->\n\`\`\`json\n${JSON.stringify(terminalPayload)}\n\`\`\``;
    const input = {repository, pr_number: pr, head, failures: terminalPayload.failures,
      comments: [trustedComment(startBody, 10), trustedComment(terminalBody, 11)]};
    const state = ciAutofixMemoryState(input);
    expect(state.starts[0]).toEqual(legacy);
    expect(state.terminals[0]).toMatchObject(legacy);
    expect(prepareCiAutofixTerminalBackfill(input)).toMatchObject({backfilled: 0, skipped_historical_strategy: 1});
    expect(decideCiAutofixStrategyHistory({...input, ...state})).toMatchObject({decision: "ALLOW_MATERIAL_REENTRY"});
    const recovered = prepareCiAutofixTerminalFromStart({...input, comments: [input.comments[0]], start: state.starts[0],
      outcome: "unknown", observed_at: "2026-10-06T12:00:00Z"});
    expect(recovered.terminal).toMatchObject({...legacy, outcome: "unknown"});
  });
});
