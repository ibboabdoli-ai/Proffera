import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { createMemory, memoryIdentity, mergeObservation, serializeMemory } from "../scripts/supervisor-failure-memory.mjs";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { MAX_AUTOMATIC_REVIEW_REPAIR_ATTEMPTS, REVIEW_REPAIR_EXECUTION_CONTRACT, REVIEW_REPAIR_EXECUTION_PROMPT, decideReviewRepairStrategyHistory, parseReviewRepairStarts, prepareReviewRepairOutcome, reviewRepairObservation, reviewRepairStartBody, reviewRepairStrategyDescriptor } from "../scripts/supervisor-review-repair-strategy-memory.mjs";

const repository = "ibboabdoli-ai/Proffera";
const pr = 923;
const head = "a".repeat(40);
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
