import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, memoryIdentity, mergeObservation } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { CI_AUTOFIX_EXECUTION_CONTRACT, CI_AUTOFIX_EXECUTION_PROMPT, ciAutofixMemoryState, ciAutofixObservation, ciAutofixRecoveryBody, ciAutofixStartBody, ciAutofixStrategyDescriptor, ciAutofixTerminalBody, decideCiAutofixStrategyHistory, parseCiAutofixStarts, parseCiAutofixTerminals, prepareCiAutofixOutcome, prepareCiAutofixTerminal, proveCiAutofixPrelaunchRecovery, unresolvedCiAutofixStarts } from "../scripts/supervisor-ci-autofix-strategy-memory.mjs";

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
});

describe("CI Autofix workflow accounting boundary", () => {
  const workflow = readFileSync(new URL("../.github/workflows/proffera-ci-autofix.yml", import.meta.url), "utf8")
    .replaceAll("\r\n", "\n");
  const handoff = readFileSync(new URL("../scripts/supervisor-worker-handoff.mjs", import.meta.url), "utf8");

  it("serializes admission and recording through the shared Failure Memory mutex", () => {
    expect(workflow).toContain("group: proffera-final-gate-memory-${{ fromJSON(needs.prepare.outputs.pr_number) }}");
    expect(workflow).toContain("queue: max");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("Admit one bounded CI autofix strategy");
    expect(workflow).toContain("Record durable CI Autofix attempt outcome");
  });

  it("keeps the model job outside issue-write authority and revalidates the exact head immediately before model execution", () => {
    const startIndex = workflow.indexOf("  autofix:\n");
    const endIndex = workflow.indexOf("\n  record:", startIndex);
    const job = workflow.slice(startIndex, endIndex);
    expect(job).toContain("Revalidate exact failed head before model");
    expect(job).toContain("Run one bounded Codex repair attempt");
    expect(job).not.toContain("issues: write");
    expect(job.indexOf("Revalidate exact failed head before model"))
      .toBeLessThan(job.indexOf("Run one bounded Codex repair attempt"));
  });

  it("uses complete exact source-run job evidence and records all terminal model outcomes", () => {
    expect(workflow).toContain("actions/runs/$RUN_ID/attempts/$RUN_ATTEMPT/jobs?per_page=100");
    expect(workflow).toContain('gh run view "$RUN_ID" --repo "$REPOSITORY" --attempt "$RUN_ATTEMPT" --log-failed');
    expect(workflow).toContain("gh api --paginate");
    for (const outcome of ["cancelled", "no_change", "succeeded", "failed"]) {
      expect(workflow).toContain(`outcome=${outcome}`);
    }
  });

  it("persists terminal tombstones before bounded Failure Memory and treats publication as authoritative", () => {
    const recordStart = workflow.indexOf("  record:\n");
    const record = workflow.slice(recordStart);
    expect(record).toContain("prepare-terminal");
    expect(record.indexOf('terminal_plan="$(node scripts/supervisor-ci-autofix-strategy-memory.mjs prepare-terminal'))
      .toBeLessThan(record.indexOf('prepare_plan "$comments_a" "$plan_a"'));
    const classifyStart = record.indexOf('outcome=failed');
    const classifyEnd = record.indexOf('echo "CI_AUTOFIX_OUTCOME=', classifyStart);
    const classify = record.slice(classifyStart, classifyEnd);
    expect(classify.indexOf('[ "$PUBLISHED" = "yes" ]')).toBeLessThan(classify.indexOf('[ "$AUTOFIX_RESULT" != "success" ]'));
  });

  it("protects the CI Autofix strategy helper from ordinary Worker scope", () => {
    expect(handoff).toContain('"scripts/supervisor-ci-autofix-strategy-memory.mjs"');
  });
});
