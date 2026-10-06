import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, memoryIdentity, mergeObservation } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { CI_AUTOFIX_EXECUTION_CONTRACT, CI_AUTOFIX_EXECUTION_PROMPT, ciAutofixMemoryState, ciAutofixObservation, ciAutofixRecoveryBody, ciAutofixStartBody, ciAutofixStrategyDescriptor, ciAutofixTerminalBody, decideCiAutofixStrategyHistory, parseCiAutofixStarts, parseCiAutofixTerminals, prepareCiAutofixOutcome, prepareCiAutofixTerminal, prepareCiAutofixTerminalBackfill, prepareCiAutofixTerminalFromStart, proveCiAutofixIndeterminateRecovery, proveCiAutofixModelNotLaunched, proveCiAutofixPrelaunchRecovery, unresolvedCiAutofixStarts } from "../scripts/supervisor-ci-autofix-strategy-memory.mjs";

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

  it("keeps the workflow prompt byte-aligned with the strategy contract", () => {
    const workflow = readFileSync(new URL("../.github/workflows/proffera-ci-autofix.yml", import.meta.url), "utf8")
      .replaceAll("\r\n", "\n");
    const marker = "          prompt: |\n";
    const startIndex = workflow.indexOf(marker);
    const endIndex = workflow.indexOf("\n\n      - name:", startIndex);
    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);
    const prompt = workflow.slice(startIndex + marker.length, endIndex)
      .split("\n")
      .map((line: string) => line.startsWith("            ") ? line.slice(12) : line)
      .join("\n");
    expect(prompt).toBe(CI_AUTOFIX_EXECUTION_PROMPT);
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
      recoverable: true, reason: "model_outcome_unknown", observed_at: "2026-10-05T18:01:00Z",
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
  type WorkflowStep = {name?: string; id?: string; run?: string};
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

    expect(admit).toContain("actions/runs/$SOURCE_RUN_ID/attempts/$SOURCE_RUN_ATTEMPT/jobs?per_page=100");
    expect(capture).toContain('gh run view "$RUN_ID" --repo "$REPOSITORY" --attempt "$RUN_ATTEMPT" --log-failed');
    for (const outcome of ["cancelled", "no_change", "succeeded", "failed"]) {
      expect(classify).toContain(`outcome=${outcome}`);
    }
  });

  it("recovers post-model bookkeeping loss as unknown and backfills terminal-only accounting before admission", () => {
    const admit = run("admit", "Recover proven pre-model starts and admit exact-head CI evidence");
    expect(admit).toContain("indeterminate-proof");
    expect(admit).toContain('--arg outcome "unknown"');
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
    expect(classify).toContain("model-proof");
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
    expect(classify.indexOf('[ "$PUBLISHED" = "yes" ]'))
      .toBeLessThan(classify.indexOf('[ "$AUTOFIX_RESULT" != "success" ]'));
  });

  it("protects the CI Autofix strategy helper from ordinary Worker scope", () => {
    expect(handoff).toContain('"scripts/supervisor-ci-autofix-strategy-memory.mjs"');
  });
});
