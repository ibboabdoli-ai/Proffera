import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, memoryIdentity, mergeObservation, serializeMemory } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { MAX_AUTOMATIC_REVIEW_REPAIR_ATTEMPTS, REVIEW_REPAIR_EXECUTION_CONTRACT, REVIEW_REPAIR_EXECUTION_PROMPT, decideReviewRepairStrategyHistory, parseReviewRepairRecoveries, parseReviewRepairStarts, prepareReviewRepairOutcome, proveReviewRepairPrelaunchRecovery, reviewRepairMemoryState, reviewRepairObservation, reviewRepairRecoveryBody, reviewRepairStartBody, reviewRepairStrategyDescriptor, unresolvedReviewRepairStarts } from "../scripts/supervisor-review-repair-strategy-memory.mjs";

const repository = "ibboabdoli-ai/Proffera";
const pr = 923;
const head = "a".repeat(40);
const dispatchHead = "f".repeat(40);
const findings = ["inline:101", "review:202"];

function failureRecord({
  finding_ids = findings,
  outcome = "failed",
  run_id = 10,
  run_attempt = 1,
  attemptHead = head,
}: {
  finding_ids?: string[];
  outcome?: "failed" | "no_change" | "cancelled" | "succeeded";
  run_id?: number;
  run_attempt?: number;
  attemptHead?: string;
} = {}) {
  const memory = createMemory(repository, {kind: "pull_request", pr_number: pr});
  const observation = reviewRepairObservation({
    repository,
    pr_number: pr,
    head: attemptHead,
    finding_ids,
    outcome,
    run_id,
    run_attempt,
    observed_at: "2026-10-04T08:00:00Z",
  });
  return mergeObservation(
    {comment_id: null, memory},
    memoryIdentity({comment_id: null, memory}),
    observation,
  ).memory.records[0];
}

function start({
  finding_ids = findings,
  run_id = 10,
  run_attempt = 1,
  attemptHead = head,
}: {
  finding_ids?: string[];
  run_id?: number;
  run_attempt?: number;
  attemptHead?: string;
} = {}) {
  const descriptor = reviewRepairStrategyDescriptor({
    pr_number: pr,
    head: attemptHead,
    finding_ids,
  });
  return {
    pr_number: pr,
    run_id,
    run_attempt,
    head: attemptHead,
    finding_digest: descriptor.finding_digest,
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
  };
}

function trustedComment(body: string, id = 1) {
  return {
    id,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
    user: {login: "github-actions[bot]", type: "Bot"},
    body,
  };
}

function recoveryBody({
  finding_ids = findings,
  run_id = 10,
  run_attempt = 1,
  attemptHead = head,
  recovered_by_run_id = 20,
  recovered_by_run_attempt = 1,
}: {
  finding_ids?: string[];
  run_id?: number;
  run_attempt?: number;
  attemptHead?: string;
  recovered_by_run_id?: number;
  recovered_by_run_attempt?: number;
} = {}) {
  return reviewRepairRecoveryBody({
    repository,
    pr_number: pr,
    start: start({finding_ids, run_id, run_attempt, attemptHead}),
    recovered_by_run_id,
    recovered_by_run_attempt,
  });
}

describe("Review Repair stable strategy identity", () => {
  it("deduplicates finding order and duplicate delivery", () => {
    const a = reviewRepairStrategyDescriptor({
      pr_number: pr,
      head,
      finding_ids: ["review:202", "inline:101", "inline:101"],
    });
    const b = reviewRepairStrategyDescriptor({
      pr_number: pr,
      head,
      finding_ids: ["inline:101", "review:202"],
    });
    expect(a.finding_ids).toEqual(["inline:101", "review:202"]);
    expect(a.finding_digest).toBe(b.finding_digest);
    expect(a.evidence_fingerprint).toBe(b.evidence_fingerprint);
    expect(a.strategy_fingerprint).toBe(b.strategy_fingerprint);
  });

  it("treats a new finding or changed exact head as new material review evidence", () => {
    const current = reviewRepairStrategyDescriptor({pr_number: pr, head, finding_ids: findings});
    const newFinding = reviewRepairStrategyDescriptor({
      pr_number: pr,
      head,
      finding_ids: [...findings, "inline:303"],
    });
    const newHead = reviewRepairStrategyDescriptor({
      pr_number: pr,
      head: "b".repeat(40),
      finding_ids: findings,
    });
    expect(newFinding.evidence_fingerprint).not.toBe(current.evidence_fingerprint);
    expect(newHead.evidence_fingerprint).not.toBe(current.evidence_fingerprint);
    expect(newFinding.strategy_fingerprint).toBe(current.strategy_fingerprint);
  });

  it("binds repair strategy identity to the canonical execution contract", () => {
    const current = reviewRepairStrategyDescriptor({pr_number: pr, head, finding_ids: findings});
    const changed = reviewRepairStrategyDescriptor(
      {pr_number: pr, head, finding_ids: findings},
      {
        ...REVIEW_REPAIR_EXECUTION_CONTRACT,
        prompt_version: "review_repair_v2",
        prompt: REVIEW_REPAIR_EXECUTION_PROMPT + "\nA materially different repair contract.",
      },
    );
    expect(changed.evidence_fingerprint).toBe(current.evidence_fingerprint);
    expect(changed.strategy_fingerprint).not.toBe(current.strategy_fingerprint);
  });

  it("keeps the workflow prompt byte-aligned with the strategy contract", () => {
    const workflow = readFileSync(new URL("../.github/workflows/supervisor-review-repair.yml", import.meta.url), "utf8")
      .replaceAll("\r\n", "\n");
    const marker = "          prompt: |\n";
    const start = workflow.indexOf(marker);
    const end = workflow.indexOf("\n\n      - name:", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const prompt = workflow.slice(start + marker.length, end)
      .split("\n")
      .map((line: string) => line.startsWith("            ") ? line.slice(12) : line)
      .join("\n");
    expect(prompt).toBe(REVIEW_REPAIR_EXECUTION_PROMPT);
  });
});

describe("Review Repair attempt admission", () => {
  it("allows the first settled review burst", () => {
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr,
      head,
      finding_ids: findings,
      records: [],
      starts: [],
    })).toMatchObject({decision: "ALLOW", attempts: 0});
  });

  it.each(["failed", "no_change", "cancelled", "succeeded"] as const)(
    "suppresses the same settled burst after a durable %s attempt",
    (outcome) => {
      expect(decideReviewRepairStrategyHistory({
        pr_number: pr,
        head,
        finding_ids: findings,
        records: [failureRecord({outcome})],
        starts: [start()],
      })).toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 1});
    },
  );

  it("fails closed on the same unresolved started attempt", () => {
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr,
      head,
      finding_ids: findings,
      records: [],
      starts: [start()],
    })).toMatchObject({
      decision: "SUPPRESS_UNRESOLVED_ATTEMPT",
      attempts: 1,
      unresolved_attempts: 1,
    });
  });

  it("re-admits the same evidence when a trusted recovery proves the prior start never launched", () => {
    const comments = [
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head, finding_ids: findings, run_id: 10, run_attempt: 1,
      }), 10),
      trustedComment(recoveryBody(), 11),
    ];
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(state.starts).toEqual([]);
    expect(state.recoveries).toHaveLength(1);
    expect(unresolvedReviewRepairStarts({repository, pr_number: pr, head, finding_ids: findings, comments}))
      .toEqual([]);
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr,
      head,
      finding_ids: findings,
      records: state.records,
      starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 0, unresolved_attempts: 0});
  });

  it("does not let a recovery erase an attempt that already has a durable outcome", () => {
    const comments = [
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head, finding_ids: findings, run_id: 10, run_attempt: 1,
      }), 10),
      trustedComment(recoveryBody(), 11),
      trustedComment(serializeMemory(mergeObservation(
        {comment_id: null, memory: createMemory(repository, {kind: "pull_request", pr_number: pr})},
        memoryIdentity({comment_id: null, memory: createMemory(repository, {kind: "pull_request", pr_number: pr})}),
        reviewRepairObservation({
          repository, pr_number: pr, head, finding_ids: findings, outcome: "failed",
          run_id: 10, run_attempt: 1, observed_at: "2026-10-04T08:00:00Z",
        }),
      ).memory), 12),
    ];
    expect(() => reviewRepairMemoryState({repository, pr_number: pr, comments}))
      .toThrow(/recovery_record_conflict/);
  });

  it("recovers a proven pre-model start after head and findings change without spending budget", () => {
    const oldHead = "b".repeat(40);
    const oldFindings = ["inline:11"];
    const oldStart = start({finding_ids: oldFindings, run_id: 30, attemptHead: oldHead});
    const beforeRecovery = [trustedComment(reviewRepairStartBody({
      repository, pr_number: pr, head: oldHead, finding_ids: oldFindings, run_id: 30, run_attempt: 1,
    }), 30)];

    expect(unresolvedReviewRepairStarts({
      repository, pr_number: pr, head, finding_ids: findings, comments: beforeRecovery,
    })).toEqual([oldStart]);
    expect(proveReviewRepairPrelaunchRecovery({
      repository,
      pr_number: pr,
      start: oldStart,
      run: {
        id: 30, run_attempt: 1, head_sha: dispatchHead, head_branch: "main", status: "completed", conclusion: "cancelled",
        event: "workflow_dispatch", name: "Supervisor review repair",
        path: ".github/workflows/supervisor-review-repair.yml",
      },
      jobs: [{
        name: "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "failure",
      }],
    })).toEqual({recoverable: true, reason: "repair_job_absent"});

    const comments = [
      ...beforeRecovery,
      trustedComment(recoveryBody({
        finding_ids: oldFindings, run_id: 30, attemptHead: oldHead,
        recovered_by_run_id: 40, recovered_by_run_attempt: 1,
      }), 31),
    ];
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(state.starts).toEqual([]);
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr, head, finding_ids: findings, records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 0, unresolved_attempts: 0});
  });

  it("recovers two proven pre-model starts from different historical evidence without exhausting budget", () => {
    const oldA = {head: "b".repeat(40), findings: ["inline:11"], run: 31};
    const oldB = {head: "c".repeat(40), findings: ["review:12"], run: 32};
    const comments = [
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head: oldA.head, finding_ids: oldA.findings, run_id: oldA.run, run_attempt: 1,
      }), 40),
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head: oldB.head, finding_ids: oldB.findings, run_id: oldB.run, run_attempt: 1,
      }), 41),
    ];
    const oldStarts = [
      start({finding_ids: oldA.findings, run_id: oldA.run, attemptHead: oldA.head}),
      start({finding_ids: oldB.findings, run_id: oldB.run, attemptHead: oldB.head}),
    ];
    expect(unresolvedReviewRepairStarts({
      repository, pr_number: pr, head, finding_ids: findings, comments,
    })).toEqual(oldStarts);
    for (const [index, candidate] of oldStarts.entries()) {
      expect(proveReviewRepairPrelaunchRecovery({
        repository,
        pr_number: pr,
        start: candidate,
        run: {
          id: candidate.run_id, run_attempt: candidate.run_attempt, head_sha: dispatchHead, head_branch: "main",
          status: "completed", conclusion: "cancelled",
          event: "workflow_dispatch", name: "Supervisor review repair",
          path: ".github/workflows/supervisor-review-repair.yml",
        },
        jobs: index === 0
          ? [{name: "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "failure"}]
          : [
              {name: "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "failure"},
              {name: "Batch current-head review findings", status: "completed", conclusion: "skipped"},
            ],
      })).toMatchObject({recoverable: true});
    }

    comments.push(
      trustedComment(recoveryBody({
        finding_ids: oldA.findings, run_id: oldA.run, attemptHead: oldA.head,
        recovered_by_run_id: 50, recovered_by_run_attempt: 1,
      }), 42),
      trustedComment(recoveryBody({
        finding_ids: oldB.findings, run_id: oldB.run, attemptHead: oldB.head,
        recovered_by_run_id: 50, recovered_by_run_attempt: 1,
      }), 43),
    );
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(state.starts).toEqual([]);
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr, head, finding_ids: findings, records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 0});
  });

  it("keeps an older different-evidence start in budget when its repair may have launched", () => {
    const oldHead = "b".repeat(40);
    const oldFindings = ["inline:11"];
    const candidate = start({finding_ids: oldFindings, run_id: 33, attemptHead: oldHead});
    const proof = proveReviewRepairPrelaunchRecovery({
      repository,
      pr_number: pr,
      start: candidate,
      run: {
        id: 33, run_attempt: 1, head_sha: dispatchHead, head_branch: "main", status: "completed", conclusion: "cancelled",
        event: "workflow_dispatch", name: "Supervisor review repair",
        path: ".github/workflows/supervisor-review-repair.yml",
      },
      jobs: [
        {name: "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "success"},
        {name: "Batch current-head review findings", status: "completed", conclusion: "failure"},
      ],
    });
    expect(proof).toEqual({recoverable: false, reason: "repair_job_may_have_launched"});

    const comments = [trustedComment(reviewRepairStartBody({
      repository, pr_number: pr, head: oldHead, finding_ids: oldFindings, run_id: 33, run_attempt: 1,
    }), 50)];
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr, head, finding_ids: findings, records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 1});
  });

  it("charges only the real model execution when an older pre-model start is recovered", () => {
    const orphanHead = "b".repeat(40);
    const orphanFindings = ["inline:11"];
    const realHead = "c".repeat(40);
    const realFindings = ["review:12"];
    const memory = createMemory(repository, {kind: "pull_request", pr_number: pr});
    const realObservation = reviewRepairObservation({
      repository, pr_number: pr, head: realHead, finding_ids: realFindings, outcome: "failed",
      run_id: 35, run_attempt: 1, observed_at: "2026-10-04T08:00:00Z",
    });
    const realMemory = mergeObservation(
      {comment_id: null, memory},
      memoryIdentity({comment_id: null, memory}),
      realObservation,
    ).memory;
    const comments = [
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head: orphanHead, finding_ids: orphanFindings, run_id: 34, run_attempt: 1,
      }), 60),
      trustedComment(recoveryBody({
        finding_ids: orphanFindings, run_id: 34, attemptHead: orphanHead,
        recovered_by_run_id: 40, recovered_by_run_attempt: 1,
      }), 61),
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head: realHead, finding_ids: realFindings, run_id: 35, run_attempt: 1,
      }), 62),
      trustedComment(serializeMemory(realMemory), 63),
    ];
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(state.starts).toEqual([start({
      finding_ids: realFindings, run_id: 35, attemptHead: realHead,
    })]);
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr, head, finding_ids: findings, records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 1, unresolved_attempts: 0});
  });

  it("counts failed/no-change/cancelled starts against the model budget rather than repair commits", () => {
    expect(MAX_AUTOMATIC_REVIEW_REPAIR_ATTEMPTS).toBe(2);
    const oldFindings = ["inline:11"];
    const oldHead = "b".repeat(40);
    const newerHead = "c".repeat(40);
    const records = [
      failureRecord({finding_ids: oldFindings, outcome: "failed", run_id: 10, attemptHead: oldHead}),
      failureRecord({finding_ids: ["inline:12"], outcome: "no_change", run_id: 11, attemptHead: newerHead}),
    ];
    const starts = [
      start({finding_ids: oldFindings, run_id: 10, attemptHead: oldHead}),
      start({finding_ids: ["inline:12"], run_id: 11, attemptHead: newerHead}),
    ];
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr,
      head,
      finding_ids: ["inline:999"],
      records,
      starts,
    })).toMatchObject({decision: "HUMAN_REQUIRED", attempts: 2});
  });

  it("allows genuinely changed review evidence while one bounded attempt remains", () => {
    const oldFindings = ["inline:11"];
    const oldHead = "b".repeat(40);
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr,
      head,
      finding_ids: findings,
      records: [failureRecord({finding_ids: oldFindings, outcome: "failed", run_id: 10, attemptHead: oldHead})],
      starts: [start({finding_ids: oldFindings, run_id: 10, attemptHead: oldHead})],
    })).toMatchObject({decision: "ALLOW", attempts: 1});
  });
});

describe("Review Repair start provenance and Failure Memory persistence", () => {
  it("parses only canonical trusted Supervisor start markers", () => {
    const body = reviewRepairStartBody({
      repository,
      pr_number: pr,
      head,
      finding_ids: findings,
      run_id: 77,
      run_attempt: 2,
    });
    expect(parseReviewRepairStarts([trustedComment(body)], {repository, pr_number: pr}))
      .toEqual([start({run_id: 77, run_attempt: 2})]);

    expect(() => parseReviewRepairStarts([
      {...trustedComment(body), user: {login: "ibboabdoli-ai", type: "User"}},
    ], {repository, pr_number: pr})).not.toThrow();
    expect(parseReviewRepairStarts([
      {...trustedComment(body), user: {login: "ibboabdoli-ai", type: "User"}},
    ], {repository, pr_number: pr})).toEqual([]);

    const otherPrBody = reviewRepairStartBody({
      repository,
      pr_number: 924,
      head,
      finding_ids: findings,
      run_id: 78,
      run_attempt: 1,
    });
    expect(parseReviewRepairStarts([
      trustedComment(otherPrBody, 11),
      trustedComment(body, 12),
      trustedComment(body, 13),
    ], {repository, pr_number: pr})).toEqual([start({run_id: 77, run_attempt: 2})]);

    const conflictingBody = reviewRepairStartBody({
      repository,
      pr_number: pr,
      head: "b".repeat(40),
      finding_ids: findings,
      run_id: 77,
      run_attempt: 2,
    });
    expect(() => parseReviewRepairStarts([
      trustedComment(body, 14),
      trustedComment(conflictingBody, 15),
    ], {repository, pr_number: pr})).toThrow(/start_conflict/);

    expect(() => parseReviewRepairStarts([
      {...trustedComment(body), issue_url: "https://api.github.com/repos/other/repo/issues/548"},
    ], {repository, pr_number: pr})).toThrow(/start_provenance/);
  });

  it("parses only canonical trusted recovery markers and binds them to the original start", () => {
    const body = recoveryBody({run_id: 77, run_attempt: 2, recovered_by_run_id: 88, recovered_by_run_attempt: 3});
    expect(parseReviewRepairRecoveries([trustedComment(body)], {repository, pr_number: pr}))
      .toEqual([{
        ...start({run_id: 77, run_attempt: 2}),
        recovered_by_run_id: 88,
        recovered_by_run_attempt: 3,
      }]);

    expect(parseReviewRepairRecoveries([
      {...trustedComment(body), user: {login: "ibboabdoli-ai", type: "User"}},
    ], {repository, pr_number: pr})).toEqual([]);

    expect(() => parseReviewRepairRecoveries([
      {...trustedComment(body), issue_url: "https://api.github.com/repos/other/repo/issues/548"},
    ], {repository, pr_number: pr})).toThrow(/recovery_provenance/);
    expect(() => recoveryBody({
      run_id: 77, run_attempt: 2, recovered_by_run_id: 77, recovered_by_run_attempt: 2,
    })).toThrow(/recovery_self/);

    const comments = [
      trustedComment(reviewRepairStartBody({
        repository, pr_number: pr, head, finding_ids: findings, run_id: 77, run_attempt: 2,
      }), 10),
      trustedComment(recoveryBody({
        run_id: 77, run_attempt: 2, attemptHead: "b".repeat(40),
        recovered_by_run_id: 88, recovered_by_run_attempt: 3,
      }), 11),
    ];
    expect(() => reviewRepairMemoryState({repository, pr_number: pr, comments}))
      .toThrow(/recovery_start_binding/);
  });

  it("recovers only terminal historical runs whose repair job never launched", () => {
    const candidate = start({run_id: 77, run_attempt: 2});
    const run = {
      id: 77,
      run_attempt: 2,
      head_sha: dispatchHead,
      head_branch: "main",
      status: "completed",
      conclusion: "cancelled",
      event: "workflow_dispatch",
      name: "Supervisor review repair",
      path: ".github/workflows/supervisor-review-repair.yml",
    };
    const admitJob = {
      name: "Settle review burst and admit one bounded attempt", status: "completed", conclusion: "failure",
    };
    const input = {
      repository, pr_number: pr, start: candidate, run, jobs: [admitJob],
    };
    expect(proveReviewRepairPrelaunchRecovery(input))
      .toEqual({recoverable: true, reason: "repair_job_absent"});
    expect(proveReviewRepairPrelaunchRecovery({
      ...input,
      jobs: [admitJob, {name: "Batch current-head review findings", status: "completed", conclusion: "skipped"}],
    })).toEqual({recoverable: true, reason: "repair_job_skipped"});
    expect(run.head_sha).not.toBe(candidate.head);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, head_branch: "work/not-main"},
    })).toThrow(/recovery_run_binding/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, head_sha: undefined},
    })).toThrow(/recovery_run_head/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, head_sha: "not-a-sha"},
    })).toThrow(/recovery_run_head/);
    expect(proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, status: "in_progress", conclusion: null},
    })).toEqual({recoverable: false, reason: "run_not_terminal"});
    for (const conclusion of ["success", "failure", "cancelled"]) {
      expect(proveReviewRepairPrelaunchRecovery({
        ...input,
        jobs: [admitJob, {name: "Batch current-head review findings", status: "completed", conclusion}],
      })).toEqual({recoverable: false, reason: "repair_job_may_have_launched"});
    }
    expect(proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, conclusion: "success"},
    })).toEqual({recoverable: false, reason: "run_succeeded"});
    expect(() => proveReviewRepairPrelaunchRecovery({...input, jobs: []}))
      .toThrow(/recovery_jobs_binding/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, path: ".github/workflows/ci.yml"},
    })).toThrow(/recovery_run_binding/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, id: 78},
    })).toThrow(/recovery_run_binding/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      run: {...run, run_attempt: 3},
    })).toThrow(/recovery_run_binding/);
    expect(() => proveReviewRepairPrelaunchRecovery({
      ...input,
      jobs: [{name: "Batch current-head review findings", status: "completed", conclusion: "skipped"}],
    })).toThrow(/recovery_jobs_binding/);

    const comments = [trustedComment(reviewRepairStartBody({
      repository, pr_number: pr, head: candidate.head, finding_ids: findings, run_id: 77, run_attempt: 2,
    }), 70)];
    const state = reviewRepairMemoryState({repository, pr_number: pr, comments});
    expect(decideReviewRepairStrategyHistory({
      pr_number: pr, head: "d".repeat(40), finding_ids: ["inline:999"],
      records: state.records, starts: state.starts,
    })).toMatchObject({decision: "ALLOW", attempts: 1});
  });

  it("records exact action attempts in the canonical pull-request Failure Memory", () => {
    const startBody = reviewRepairStartBody({
      repository,
      pr_number: pr,
      head,
      finding_ids: findings,
      run_id: 77,
      run_attempt: 1,
    });
    const comments = [trustedComment(startBody, 10)];
    const prepared = prepareReviewRepairOutcome({
      repository,
      pr_number: pr,
      head,
      finding_ids: findings,
      outcome: "cancelled",
      run_id: 77,
      run_attempt: 1,
      observed_at: "2026-10-04T08:00:00Z",
      comments,
    });
    expect(prepared.unchanged).toBe(false);
    expect(prepared.comment_id).toBeNull();
    const body = JSON.parse(prepared.body.split("\n")[2]);
    expect(body.scope).toEqual({kind: "pull_request", pr_number: pr});
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      action_id: "review_repair_attempt",
      outcome: "cancelled",
      pr_number: pr,
      task_id: null,
      observed_head: head,
    });

    const memoryComment = trustedComment(prepared.body, 99);
    const repeated = prepareReviewRepairOutcome({
      repository,
      pr_number: pr,
      head,
      finding_ids: findings,
      outcome: "cancelled",
      run_id: 77,
      run_attempt: 1,
      observed_at: "2026-10-04T08:00:00Z",
      comments: [comments[0], memoryComment],
    });
    expect(repeated.unchanged).toBe(true);
    expect(repeated.comment_id).toBe(99);
    expect(serializeMemory(JSON.parse(repeated.body.split("\n")[2]))).toBe(repeated.body);
  });
});

type RepairWorkflowStep = {
  name: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
};
type RepairWorkflow = {
  jobs: Record<string, {
    outputs: Record<string, string>;
    steps: RepairWorkflowStep[];
  }>;
};
const loadWorkflowYaml = createRequire(import.meta.url)("js-yaml").load as (input: string) => RepairWorkflow;
const rerunWorkflow = loadWorkflowYaml(readFileSync(
  new URL("../.github/workflows/supervisor-review-repair.yml", import.meta.url), "utf8",
));
function workflowStep(job: string, name: string) {
  const result = rerunWorkflow.jobs[job].steps.find((step) => step.name === name);
  if (!result) throw new Error(`Missing workflow step: ${job}/${name}`);
  return result;
}
function resolveWorkflowValue(value: string, context: Record<string, string>) {
  return value.replace(/\$\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key: string) => {
    if (!(key in context)) throw new Error(`Missing workflow context: ${key}`);
    return context[key];
  });
}
function retryContext(runAttempt: string) {
  return {
    "github.run_id": "77",
    "github.run_attempt": runAttempt,
    "steps.preflight.outputs.head_sha": head,
    "needs.admit.outputs.head_sha": head,
    "needs.admit.outputs.admitted_run_id": "77",
    "needs.admit.outputs.admitted_run_attempt": "1",
    "needs.repair.outputs.head_sha": head,
    "needs.repair.outputs.run_id": "77",
    "needs.repair.outputs.run_attempt": "1",
  };
}
function recordingInput(outcome: "failed" | "no_change" | "cancelled" | "succeeded", recorderAttempt = "2") {
  const step = workflowStep("record", "Persist exact attempt outcome in canonical Failure Memory");
  const context = retryContext(recorderAttempt);
  return {
    repository, pr_number: pr, head, finding_ids: findings, outcome,
    run_id: Number(resolveWorkflowValue(step.env!.ADMITTED_RUN_ID, context)),
    run_attempt: Number(resolveWorkflowValue(step.env!.ADMITTED_RUN_ATTEMPT, context)),
    observed_at: "2026-10-04T09:00:00Z",
  };
}

describe("Review Repair pre-model start recovery", () => {
  const admission = workflowStep("admit", "Admit strategy history and record trusted attempt start").run!;

  it("recovers only after exact historical Actions proof and re-reads memory before admission", () => {
    expect(admission).toContain("supervisor-review-repair-strategy-memory.mjs unresolved");
    expect(admission).toContain("actions/runs/${old_run_id}/attempts/${old_run_attempt}");
    expect(admission).toContain("actions/runs/${old_run_id}/attempts/${old_run_attempt}/jobs?per_page=100");
    expect(admission).toContain("supervisor-review-repair-strategy-memory.mjs recovery-proof");
    expect(admission).toContain("supervisor-review-repair-strategy-memory.mjs recovery-body");
    expect(admission).toContain("Recovered orphaned pre-model Review Repair start");
    const proofStart = admission.indexOf('proof_input="$RUNNER_TEMP/review-repair-recovery-proof-');
    const proofEnd = admission.indexOf("supervisor-review-repair-strategy-memory.mjs recovery-proof", proofStart);
    const proofInput = admission.slice(proofStart, proofEnd);
    expect(proofInput).toContain('--argjson start "$candidate"');
    expect(proofInput).not.toContain('--arg head "$HEAD_SHA"');
    expect(proofInput).not.toContain("finding_ids.json");
    const recoveryStart = admission.indexOf('recovery_input="$RUNNER_TEMP/review-repair-recovery-');
    const recoveryEnd = admission.indexOf("supervisor-review-repair-strategy-memory.mjs recovery-body", recoveryStart);
    const recoveryInput = admission.slice(recoveryStart, recoveryEnd);
    expect(recoveryInput).toContain('--argjson start "$candidate"');
    expect(recoveryInput).not.toContain('--arg head "$HEAD_SHA"');
    expect(recoveryInput).not.toContain("finding_ids.json");
    const recoveryPost = admission.indexOf('issues/548/comments" -f "body=$recovery_body"');
    const refresh = admission.indexOf('if [ "$recovered_any" = "yes" ]');
    const decision = admission.indexOf("supervisor-review-repair-strategy-memory.mjs admit");
    expect(recoveryPost).toBeGreaterThanOrEqual(0);
    expect(refresh).toBeGreaterThan(recoveryPost);
    expect(decision).toBeGreaterThan(refresh);
  });

  it("keeps unresolved starts fail-closed when historical execution cannot be proven safe", () => {
    expect(admission).toContain("Could not prove historical Review Repair run state; leaving start unresolved.");
    expect(admission).toContain("Could not prove historical Review Repair job state; leaving start unresolved.");
    expect(admission).toContain("Historical start remains fail-closed:");
    expect(admission).not.toContain("actions/runs/${old_run_id}/rerun");
  });
});

describe("Review Repair workflow rerun artifact identity", () => {
  it("gives every producing workflow attempt distinct immutable evidence and candidate names", () => {
    for (const [job, name] of [
      ["admit", "Upload settled exact-head review evidence"],
      ["repair", "Upload exact candidate repair patch"],
    ]) {
      const upload = workflowStep(job, name);
      expect(upload.with?.overwrite).toBeUndefined();
      const artifactName = String(upload.with?.name);
      expect(artifactName).toContain("${{ github.run_attempt }}");
      const original = resolveWorkflowValue(artifactName, retryContext("1"));
      const retry = resolveWorkflowValue(artifactName, retryContext("2"));
      expect(original).not.toBe(retry);
      expect(original).toContain(`-77-1-${head}`);
      expect(retry).toContain(`-77-2-${head}`);
    }
  });

  it("downloads the producing attempt's artifacts during selected downstream-job retries", () => {
    const evidence = String(workflowStep("admit", "Upload settled exact-head review evidence").with?.name);
    const candidate = String(workflowStep("repair", "Upload exact candidate repair patch").with?.name);
    for (const [job, name, producer] of [
      ["repair", "Download settled exact-head review evidence", evidence],
      ["record", "Download settled exact-head review evidence", evidence],
      ["validate", "Download exact candidate repair patch", candidate],
      ["publish", "Download exact candidate repair patch", candidate],
    ]) {
      const downloaded = String(workflowStep(job, name).with?.name);
      expect(downloaded).not.toContain("github.run_attempt");
      expect(resolveWorkflowValue(downloaded, retryContext("2")))
        .toBe(resolveWorkflowValue(producer, retryContext("1")));
    }
  });

  it("exports acknowledged admission identity and threads it through repair and recording", () => {
    const admit = rerunWorkflow.jobs.admit;
    expect(admit.outputs.admitted_run_id).toBe("${{ steps.admit.outputs.admitted_run_id }}");
    expect(admit.outputs.admitted_run_attempt).toBe("${{ steps.admit.outputs.admitted_run_attempt }}");
    const admission = workflowStep("admit", "Admit strategy history and record trusted attempt start").run!;
    expect(admission.indexOf('echo "admitted_run_attempt=$GITHUB_RUN_ATTEMPT"'))
      .toBeGreaterThan(admission.indexOf("jq -e '.id | numbers'"));
    expect(rerunWorkflow.jobs.repair.outputs.run_id).toBe("${{ needs.admit.outputs.admitted_run_id }}");
    expect(rerunWorkflow.jobs.repair.outputs.run_attempt).toBe("${{ needs.admit.outputs.admitted_run_attempt }}");
    const record = workflowStep("record", "Persist exact attempt outcome in canonical Failure Memory");
    expect(record.run).toContain('--arg run_id "$ADMITTED_RUN_ID"');
    expect(record.run).toContain('--arg run_attempt "$ADMITTED_RUN_ATTEMPT"');
    expect(record.run).not.toContain('--arg run_attempt "$GITHUB_RUN_ATTEMPT"');
    expect(recordingInput("failed", "3")).toMatchObject({run_id: 77, run_attempt: 1});
  });
});

describe("Review Repair duplicate model execution suppression", () => {
  const guard = workflowStep("repair", "Reject reuse of an admitted model attempt");
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  function modelBoundary(currentAttempt: string, admittedAttempt = "1", currentRun = "77") {
    return spawnSync(bash, ["--noprofile", "--norc", "-c", `${guard.run}\nprintf 'MODEL_EXECUTED\\n'`], {
      encoding: "utf8",
      env: {...process.env, GITHUB_RUN_ID: currentRun, GITHUB_RUN_ATTEMPT: currentAttempt,
        ADMITTED_RUN_ID: "77", ADMITTED_RUN_ATTEMPT: admittedAttempt},
    });
  }

  it("checks identity before any PR checkout or model step", () => {
    expect(rerunWorkflow.jobs.repair.steps[0]).toBe(guard);
    expect(guard.env).toEqual({
      ADMITTED_RUN_ID: "${{ needs.admit.outputs.admitted_run_id }}",
      ADMITTED_RUN_ATTEMPT: "${{ needs.admit.outputs.admitted_run_attempt }}",
    });
    expect(rerunWorkflow.jobs.repair.steps.findIndex((step) => step.uses?.startsWith("openai/codex-action@")))
      .toBeGreaterThan(0);
  });

  it("executes once, blocks repair-only retry, and permits a separately admitted later attempt", () => {
    const original = modelBoundary("1");
    expect(original.error).toBeUndefined();
    expect(original.status).toBe(0);
    expect(original.stdout).toContain("MODEL_EXECUTED");
    const replay = modelBoundary("2");
    expect(replay.status).toBe(1);
    expect(replay.stdout).not.toContain("MODEL_EXECUTED");
    expect(replay.stderr).toContain("refusing duplicate execution");
    const newlyAdmitted = modelBoundary("2", "2");
    expect(newlyAdmitted.status).toBe(0);
    expect(newlyAdmitted.stdout).toContain("MODEL_EXECUTED");
  });

  it.each(["", "0", "1garbage"])("fails closed on malformed admitted attempt %j", (attempt) => {
    const result = modelBoundary("2", attempt);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("MODEL_EXECUTED");
  });

  it("rejects an admission belonging to another run", () => {
    const result = modelBoundary("1", "1", "78");
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("MODEL_EXECUTED");
  });
});

describe("Review Repair late retry evidence retention", () => {
  const day = 24 * 60 * 60 * 1000;
  const uploadedAt = Date.parse("2026-10-04T08:00:00Z");
  const guard = workflowStep("admit", "Verify retry evidence retention policy");
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

  it("retains both immutable producers beyond GitHub's 30-day rerun window", () => {
    for (const [job, name] of [
      ["admit", "Upload settled exact-head review evidence"],
      ["repair", "Upload exact candidate repair patch"],
    ]) {
      expect(workflowStep(job, name).with?.["retention-days"]).toBe(31);
    }
    expect(rerunWorkflow.jobs.admit.steps[0]).toBe(guard);
  });

  it.each(["", "0", "1", "29", "30", "invalid", "31", "90", "400"])(
    "rejects insufficient or malformed repository retention %j before admission",
    (retention) => {
      const result = spawnSync(bash, ["--noprofile", "--norc", "-c", guard.run + "\nprintf 'ADMISSION_REACHED\\n'"], {
        encoding: "utf8", env: {...process.env, GITHUB_RETENTION_DAYS: retention},
      });
      expect(result.error).toBeUndefined();
      const allowed = ["31", "90", "400"].includes(retention);
      expect(result.status).toBe(allowed ? 0 : 1);
      expect(result.stdout.includes("ADMISSION_REACHED")).toBe(allowed);
    },
  );

  it.each([2, 30, 30 + 1 / 1440])("can record after %s days without losing the original attempt", (days) => {
    const retryAt = uploadedAt + days * day;
    // Use each actual producer's configured expiry, not an unconditional mock download.
    for (const [job, name] of [
      ["admit", "Upload settled exact-head review evidence"],
      ["repair", "Upload exact candidate repair patch"],
    ]) {
      const retention = Number(workflowStep(job, name).with?.["retention-days"]);
      expect(uploadedAt + retention * day).toBeGreaterThan(retryAt);
    }
    const input = recordingInput("failed", "3");
    const started = trustedComment(reviewRepairStartBody(input), 10);
    const prepared = prepareReviewRepairOutcome({...input, observed_at: new Date(retryAt).toISOString(), comments: [started]});
    const records = JSON.parse(prepared.body.split("\n")[2]).records;
    const starts = parseReviewRepairStarts([started], {repository, pr_number: pr});
    expect(records[0].observations[0].source).toMatchObject({run_id: 77, attempt: 1});
    expect(decideReviewRepairStrategyHistory({pr_number: pr, head, finding_ids: findings, records, starts}))
      .toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 1, unresolved_attempts: 0});
  });
});

describe("Review Repair admitted-attempt record retries", () => {
  it.each(["failed", "no_change", "cancelled", "succeeded"] as const)(
    "records a %s record-only retry under the original start, without exhausting the budget",
    (outcome) => {
      const input = recordingInput(outcome);
      const started = trustedComment(reviewRepairStartBody(input), 10);
      const prepared = prepareReviewRepairOutcome({...input, comments: [started]});
      const memory = JSON.parse(prepared.body.split("\n")[2]);
      expect(memory.records).toHaveLength(1);
      expect(memory.records[0].observations).toHaveLength(1);
      expect(memory.records[0].observations[0].source).toMatchObject({kind: "actions", run_id: 77, attempt: 1});
      const starts = parseReviewRepairStarts([started], {repository, pr_number: pr});
      expect(decideReviewRepairStrategyHistory({pr_number: pr, head, finding_ids: findings,
        records: memory.records, starts})).toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 1, unresolved_attempts: 0});
      expect(decideReviewRepairStrategyHistory({pr_number: pr, head: "b".repeat(40), finding_ids: ["inline:303"],
        records: memory.records, starts})).toMatchObject({decision: "ALLOW", attempts: 1});
      const repeated = prepareReviewRepairOutcome({...recordingInput(outcome, "3"),
        observed_at: "2026-10-04T10:00:00Z", comments: [started, trustedComment(prepared.body, 99)]});
      expect(repeated.unchanged).toBe(true);
      expect(repeated.body).toBe(prepared.body);
      expect(repeated.comment_id).toBe(99);
    },
  );

  it("preserves an already durable outcome when a blocked model replay reports failure", () => {
    const input = recordingInput("succeeded");
    const started = trustedComment(reviewRepairStartBody(input), 10);
    const prepared = prepareReviewRepairOutcome({...input, comments: [started]});
    const replay = prepareReviewRepairOutcome({...input, outcome: "failed",
      observed_at: "2026-10-04T10:00:00Z", comments: [started, trustedComment(prepared.body, 99)]});
    expect(replay.unchanged).toBe(true);
    expect(replay.body).toBe(prepared.body);
  });

  it("rejects a recorder's new attempt identity or evidence not bound to the durable start", () => {
    const input = recordingInput("failed");
    const comments = [trustedComment(reviewRepairStartBody(input), 10)];
    for (const change of [{run_attempt: 2}, {run_id: 78}, {head: "b".repeat(40)}, {finding_ids: ["inline:303"]}]) {
      expect(() => prepareReviewRepairOutcome({...input, ...change, comments})).toThrow(/outcome_start_binding/);
    }
    expect(() => prepareReviewRepairOutcome({...input, comments: []})).toThrow(/outcome_start_binding/);
  });

  it("counts exactly two genuinely started model attempts despite multiple record retries", () => {
    const first = recordingInput("failed");
    const firstStart = trustedComment(reviewRepairStartBody(first), 10);
    const one = prepareReviewRepairOutcome({...first, comments: [firstStart]});
    const second = {...first, head: "b".repeat(40), finding_ids: ["inline:303"], run_attempt: 2};
    const secondStart = trustedComment(reviewRepairStartBody(second), 11);
    const two = prepareReviewRepairOutcome({...second, comments: [firstStart, secondStart, trustedComment(one.body, 99)]});
    const replay = prepareReviewRepairOutcome({...second, observed_at: "2026-10-04T10:00:00Z",
      comments: [firstStart, secondStart, trustedComment(two.body, 99)]});
    expect(replay.unchanged).toBe(true);
    const records = JSON.parse(replay.body.split("\n")[2]).records;
    const starts = parseReviewRepairStarts([firstStart, secondStart], {repository, pr_number: pr});
    expect(decideReviewRepairStrategyHistory({pr_number: pr, head: second.head, finding_ids: second.finding_ids,
      records, starts})).toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 2, unresolved_attempts: 0});
    expect(decideReviewRepairStrategyHistory({pr_number: pr, head: "c".repeat(40), finding_ids: ["inline:404"],
      records, starts})).toMatchObject({decision: "HUMAN_REQUIRED", attempts: 2});
  });
});
