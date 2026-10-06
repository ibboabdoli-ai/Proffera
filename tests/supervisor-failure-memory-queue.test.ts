import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
// @ts-expect-error Standalone .mjs follows the repository control-plane convention.
import { decideReviewRepairStrategyHistory, parseReviewRepairStarts, prepareReviewRepairOutcome, reviewRepairStartBody } from "../scripts/supervisor-review-repair-strategy-memory.mjs";

type Concurrency = { group: string; queue?: "single" | "max"; "cancel-in-progress"?: boolean };
type Workflow = {
  concurrency?: Concurrency | string;
  jobs: Record<string, { concurrency?: Concurrency | string }>;
};
const yamlLoad = createRequire(import.meta.url)("js-yaml").load as (text: string) => Workflow;
const directory = new URL("../.github/workflows/", import.meta.url);
const inputGroup = "proffera-final-gate-memory-${{ fromJSON(inputs.pr_number) }}";
const ciGroup = "proffera-final-gate-memory-${{ fromJSON(needs.prepare.outputs.pr_number) }}";
const workflows = Object.fromEntries(readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))
  .map((name) => [name, yamlLoad(readFileSync(new URL(name, directory), "utf8"))]));
const writers = [
  ["supervisor-review-repair.yml", "admit", inputGroup],
  ["supervisor-review-repair.yml", "record", inputGroup],
  ["proffera-final-gate-wakeup.yml", "wake-final-gate", inputGroup],
  ["proffera-ci-autofix.yml", "admit", ciGroup],
  ["proffera-ci-autofix.yml", "record", ciGroup],
] as const;
function settings(index: number): Concurrency {
  const [file, job] = writers[index];
  const value = workflows[file].jobs[job].concurrency;
  if (!value || typeof value === "string") throw new Error(`Missing explicit concurrency for ${file}/${job}`);
  return value;
}

// Model only the documented pending-queue contract while another writer holds
// the group. This is not a live test of GitHub's scheduler or a FIFO guarantee.
// https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
function pendingQueue() {
  const pending: { id: string; execute: () => void }[] = [];
  const cancelled: string[] = [];
  return {
    pending, cancelled,
    enqueue(id: string, config: Concurrency, execute: () => void) {
      if (config["cancel-in-progress"] !== false) throw new Error("Writer may cancel the lock holder");
      if ((config.queue ?? "single") === "single") {
        cancelled.push(...pending.splice(0).map((job) => job.id));
      } else if (pending.length === 100) {
        cancelled.push(id);
        return;
      }
      pending.push({id, execute});
    },
    drain() { while (pending.length) pending.shift()!.execute(); },
  };
}

function attempt(outcome: "failed" | "no_change" | "cancelled" | "succeeded" = "failed") {
  const input = {repository: "ibboabdoli-ai/Proffera", pr_number: 929, head: "a".repeat(40),
    finding_ids: ["inline:101"], run_id: 77, run_attempt: 1, outcome,
    observed_at: "2026-10-04T13:00:00Z"};
  const trustedComment = (body: string, id: number) => ({id, body,
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
    user: {login: "github-actions[bot]", type: "Bot"}});
  const comments = [trustedComment(reviewRepairStartBody(input), 10)];
  const history = () => ({...input,
    starts: parseReviewRepairStarts(comments, input),
    records: comments.length === 1 ? [] : JSON.parse(comments[1].body.split("\n")[2]).records});
  return {
    input, comments, history,
    record() {
      const result = prepareReviewRepairOutcome({...input, comments});
      comments[1] = trustedComment(result.body, 11);
      return result;
    },
    admit() { return decideReviewRepairStrategyHistory(history()); },
  };
}

describe("Shared Failure Memory writer queue", () => {
  it.each([0, 1, 2, 3, 4])("opts writer %i into the same bounded non-cancelling multi-entry queue", (index) => {
    expect(settings(index)).toEqual({group: writers[index][2], queue: "max", "cancel-in-progress": false});
  });

  it("canonicalizes the PR number inside every shared mutex key", () => {
    expect(inputGroup).toBe("proffera-final-gate-memory-${{ fromJSON(inputs.pr_number) }}");
    expect(ciGroup).toBe("proffera-final-gate-memory-${{ fromJSON(needs.prepare.outputs.pr_number) }}");
    for (const [file, job, expectedGroup] of writers) {
      const config = workflows[file].jobs[job].concurrency;
      expect(typeof config).not.toBe("string");
      expect((config as Concurrency).group).toBe(expectedGroup);
      expect((config as Concurrency).group).not.toContain("${{ inputs.pr_number }}");
      expect((config as Concurrency).group).not.toContain("${{ needs.prepare.outputs.pr_number }}");
    }
  });
  it("finds every shared-group participant, including the sibling final-gate workflow", () => {
    const found: string[] = [];
    for (const [file, workflow] of Object.entries(workflows)) {
      for (const [job, config] of [["workflow", workflow.concurrency], ...Object.entries(workflow.jobs ?? {})
        .map(([id, value]) => [id, value.concurrency])] as [string, Concurrency | string | undefined][]) {
        const name = typeof config === "string" ? config : config?.group;
        if (!name?.toLowerCase().includes("proffera-final-gate-memory-")) continue;
        expect(config).toMatchObject({queue: "max", "cancel-in-progress": false});
        expect([inputGroup, ciGroup]).toContain((config as Concurrency).group);
        found.push(`${file}/${job}`);
      }
    }
    expect(found.sort()).toEqual(writers.map(([file, job]) => `${file}/${job}`).sort());
  });

  it("keeps the per-PR mutex off model, validation, publication and workflow-wide execution", () => {
    for (const file of [...new Set(writers.map(([name]) => name))]) {
      const config = workflows[file].concurrency;
      const name = typeof config === "string" ? config : config?.group;
      expect(name ?? "").not.toContain("proffera-final-gate-memory-");
    }
    for (const job of ["repair", "validate", "publish"]) {
      expect(workflows["supervisor-review-repair.yml"].jobs[job].concurrency).toBeUndefined();
    }
    const key = (input: string) =>
      settings(0).group.replace("${{ fromJSON(inputs.pr_number) }}", String(JSON.parse(input)));
    const ciKey = (input: string) =>
      settings(3).group.replace("${{ fromJSON(needs.prepare.outputs.pr_number) }}", String(JSON.parse(input)));
    expect(key("929")).not.toBe(key("930"));
    expect(key("929")).toBe("proffera-final-gate-memory-929");
    expect(key("929.0")).toBe(key("929"));
    expect(key("9.29e2")).toBe(key("929"));
    expect(ciKey("929.0")).toBe(key("929"));
    expect(ciKey("9.29e2")).toBe(key("929"));
    expect(() => key("0929")).toThrow();
    expect(() => ciKey("0929")).toThrow();
  });

  it("reproduces lost recording under the historical one-pending-job policy", () => {
    const state = attempt();
    const queue = pendingQueue();
    const single = {...settings(0), queue: "single" as const};
    queue.enqueue("record", single, () => { state.record(); });
    queue.enqueue("duplicate-admit", single, () => { state.admit(); });
    queue.enqueue("wakeup", single, () => {});
    queue.drain();
    expect(queue.cancelled).toContain("record");
    expect(state.admit()).toMatchObject({decision: "SUPPRESS_UNRESOLVED_ATTEMPT", attempts: 1, unresolved_attempts: 1});
  });

  it.each(["failed", "no_change", "cancelled", "succeeded"] as const)(
    "preserves queued %s recording across admission and wakeup arrivals", (outcome) => {
      // Also vary arrival order: safety must not depend on admission running after recording.
      for (const order of [[1, 0, 2], [0, 2, 1], [2, 1, 0]]) {
        const state = attempt(outcome);
        const queue = pendingQueue();
        let extraExecutions = 0;
        const execute = [() => { if (state.admit().decision === "ALLOW") extraExecutions++; },
          () => { state.record(); }, () => {}];
        for (const index of order) queue.enqueue(String(index), settings(index), execute[index]);
        expect(queue.pending).toHaveLength(3);
        queue.drain();
        expect(queue.cancelled).toEqual([]);
        expect(extraExecutions).toBe(0);
        expect(state.admit()).toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 1, unresolved_attempts: 0});
        const recorded = state.history().records;
        expect(recorded).toHaveLength(1);
        expect(recorded[0].observations).toHaveLength(1);
        expect(recorded[0].observations[0].source).toMatchObject({run_id: 77, attempt: 1});
        expect(recorded[0].outcome).toBe(outcome);
        expect(state.record().unchanged).toBe(true);
        expect(decideReviewRepairStrategyHistory({...state.history(), head: "b".repeat(40), finding_ids: ["inline:102"]}))
          .toMatchObject({decision: "ALLOW", attempts: 1});
      }
    },
  );

  it("keeps the documented 100-pending ceiling and fails closed when an overflow record is cancelled", () => {
    const state = attempt();
    const queue = pendingQueue();
    for (let index = 0; index < 100; index++) queue.enqueue(`wakeup-${index}`, settings(2), () => {});
    queue.enqueue("overflow-record", settings(1), () => { state.record(); });
    expect(queue.pending).toHaveLength(100);
    expect(queue.cancelled).toEqual(["overflow-record"]);
    queue.drain();
    expect(state.admit()).toMatchObject({decision: "SUPPRESS_UNRESOLVED_ATTEMPT", attempts: 1, unresolved_attempts: 1});
    // Explicit retry of the original recording resolves the start, not a second model attempt.
    state.record();
    expect(state.admit()).toMatchObject({decision: "SUPPRESS_REPEAT", attempts: 1, unresolved_attempts: 0});
  });
});
