import { describe, expect, it } from "vitest";
// JavaScript control-plane scripts are exercised directly, as in existing tests.
// @ts-expect-error Standalone Node .mjs has no declaration file.
import { aggregateMetrics, collectEvidence, classifyAttempt } from "../scripts/supervisor-metrics.mjs";

const head = "81fecf4a9c5133064afdaead680c18e4689dc734";
const paths = {planner: ".github/workflows/supervisor-planner.yml", ci: ".github/workflows/ci.yml",
  repair: ".github/workflows/supervisor-review-repair.yml", worker: ".github/workflows/supervisor-worker-handoff.yml"};
const at = (seconds: number) => new Date(Date.UTC(2026, 8, 30) + seconds * 1000).toISOString();
const run = (id = 1, attempt = 1, kind: keyof typeof paths = "ci", overrides = {}) => ({
  id, run_attempt: attempt, path: paths[kind], head_sha: head, status: "completed", conclusion: "success",
  created_at: at(0), run_started_at: at((attempt - 1) * 1000), updated_at: at((attempt - 1) * 1000 + 312),
  pull_requests: [{number: 915, head: {sha: head}}], ...overrides,
});
const job = (id: number, name: string, start = 1, end = 10, overrides = {}) => ({
  id, name, runner_id: 42, status: "completed", conclusion: "success", started_at: at(start), completed_at: at(end), steps: [], ...overrides,
});
const step = (name: string, conclusion = "success", start = 2, end = 5) => ({
  name, conclusion, status: "completed", started_at: at(start), completed_at: at(end),
});
const attempt = (r: ReturnType<typeof run>, jobs: ReturnType<typeof job>[] = [], overrides = {}) => ({
  run: r, jobs: {total_count: jobs.length, jobs}, jobs_complete: true, logs: {}, ...overrides,
});
const evidence = (runs: unknown[]) => ({schema_version: 1, repository: "ibboabdoli-ai/Proffera", runs});
const one = (a: ReturnType<typeof attempt>) => evidence([{run: a.run, attempts: [a]}]);
const metrics = (a: ReturnType<typeof attempt>) => aggregateMetrics(one(a));

describe("Supervisor A1 deterministic metrics", () => {
  it("classifies all 15 historical planner startup failures without inventing execution", () => {
    const input = evidence(Array.from({length: 15}, (_, i) => {
      const r = run(100 + i, 1, "planner", {conclusion: "startup_failure"});
      return {run: r, attempts: [attempt(r)]};
    }));
    const result = aggregateMetrics(input);
    expect(result.planner).toMatchObject({total: 15, startup_failure: 15, success: 0, model_executions: 0});
    expect(result.failure_categories.workflow_invalid).toBe(15);
    expect(result.executed_job_seconds).toBe(0);
    expect(result.model_execution.worker.executed).toBe(0);
  });

  it("recognizes run 36761809827: successful disabled planner, skipped model and dispatch", () => {
    const r = run(36761809827, 1, "planner");
    const result = metrics(attempt(r, [
      job(110045998941, "Select one bounded next task", 1, 3, {steps: [
        step("Require both autopilot kill switches and planner credential"),
        step("Ask Codex for exactly one next bounded task", "skipped"),
      ]}),
      job(110046042653, "Dispatch validated packet through trusted internal handoff", 3, 3, {conclusion: "skipped"}),
    ]));
    expect(result.planner.success).toBe(1);
    expect(result.planner.model_executions).toBe(0);
    expect(result.model_execution.planner).toMatchObject({workflow_runs: 1, executed: 0, skipped: 1, eligible_observed: 0});
    expect(result.model_execution.worker.executed).toBe(0);
    expect(result.executed_job_seconds).toBe(2);
  });

  it("counts a skipped model job as skipped, never success/execution", () => {
    const result = metrics(attempt(run(1, 1, "worker"), [
      job(1, "Run bounded Codex Worker", 0, 0, {conclusion: "skipped"}),
    ]));
    expect(result.model_execution.worker).toMatchObject({executed: 0, skipped: 1, eligible_observed: 0});
  });

  it("counts actual model action executions even when the action fails", () => {
    const result = metrics(attempt(run(1, 1, "planner", {conclusion: "failure"}), [
      job(1, "Select one bounded next task", 1, 10, {steps: [
        step("Ask Codex for exactly one next bounded task", "failure"),
      ]}),
    ]));
    expect(result.model_execution.planner).toMatchObject({executed: 1, eligible_observed: 1, skipped: 0});
  });

  function sevenAttempts(withBlocking = false) {
    // Historical run 36622937789: GitHub clones inherited successful jobs with
    // different IDs and run_attempt values but unchanged execution timestamps.
    const attempts = Array.from({length: 7}, (_, index) => {
      const n = index + 1, start = index * 1000;
      const gateId = 1000 + n;
      return attempt(run(36622937789, n, "ci", {conclusion: "failure"}), [
        job(n * 10 + 1, "Build", 1, 77, {run_attempt: n}),
        job(n * 10 + 2, "E2E public smoke run", 1, 112, {run_attempt: n}),
        job(gateId, "E2E public smoke", start + 120, start + 140, {conclusion: "failure", run_attempt: n}),
      ], withBlocking ? {blocking_evidence: {[gateId]: {
        complete: true, head_sha: head, captured_at: at(start + 130),
        items: [{id: 55, state: "CHANGES_REQUESTED", updated_at: at(100)}],
      }}} : {});
    });
    return evidence([{run: attempts[6].run, attempts}]);
  }

  it("counts seven final-gate attempts but heavy build/browser work only once", () => {
    const result = aggregateMetrics(sevenAttempts());
    expect(result.ci).toMatchObject({total: 1, failure: 1, attempts: 7});
    expect(result.final_gate).toMatchObject({total_attempts: 7, repeated_pr_head_attempts: 6,
      unchanged_blocking_evidence_observed: 0, unchanged_blocking_evidence_unknown: 6});
    expect(result.executed_job_seconds).toBe(76 + 111 + 7 * 20);
    expect(result.executed_jobs).toHaveLength(9);
    expect(result.attempts[6].observed_job_seconds).toBe(20);
  });

  it("counts unchanged blocking evidence only with complete contemporaneous snapshots", () => {
    const result = aggregateMetrics(sevenAttempts(true));
    expect(result.final_gate).toMatchObject({unchanged_blocking_evidence_observed: 6,
      unchanged_blocking_evidence_unknown: 0});
    const input = sevenAttempts(true);
    const entries = input.runs as {attempts: ReturnType<typeof attempt>[]}[];
    const last = entries[0].attempts[6] as ReturnType<typeof attempt> & {blocking_evidence: Record<string, {head_sha: string}>};
    last.blocking_evidence["1007"].head_sha = "a".repeat(40);
    expect(aggregateMetrics(input).final_gate.unchanged_blocking_evidence_observed).toBe(5);
  });

  it("does not count repeat gates across different PR heads", () => {
    const a = attempt(run(1), [job(1, "E2E public smoke")]);
    const b = attempt(run(2, 1, "ci", {head_sha: "a".repeat(40), pull_requests: [{number: 915, head: {sha: "a".repeat(40)}}]}),
      [job(2, "E2E public smoke")]);
    expect(aggregateMetrics(evidence([{run: a.run, attempts: [a]}, {run: b.run, attempts: [b]}])).final_gate.repeated_pr_head_attempts).toBe(0);
  });

  it("keeps absent PR association unknown instead of grouping unrelated heads", () => {
    const result = metrics(attempt(run(1, 1, "ci", {pull_requests: []}), [job(1, "E2E public smoke")]));
    expect(result.final_gate).toMatchObject({pr_binding_unknown: 1, repeated_pr_head_attempts: null, repeated_pr_head_attempts_observed: 0});
  });

  it("classifies successful browser plus failed review gate as review_blocked", () => {
    const result = metrics(attempt(run(1, 1, "ci", {conclusion: "failure"}), [
      job(1, "E2E public smoke run"), job(2, "E2E public smoke", 12, 20, {conclusion: "failure"}),
    ], {logs: {2: at(19) + " CodeRabbit posted current-head review findings; refusing review acceptance."}}));
    expect(result.failure_categories.review_blocked).toBe(1);
    expect(result.failure_categories.browser_failure).toBe(0);
  });

  it("distinguishes actual browser and unit failures", () => {
    const result = metrics(attempt(run(1, 1, "ci", {conclusion: "failure"}), [
      job(1, "E2E public smoke run", 1, 10, {conclusion: "failure", steps: [step("Run non-destructive public smoke tests", "failure")]}),
      job(2, "Unit and worker tests", 1, 10, {conclusion: "failure", steps: [step("Test", "failure")]}),
    ]));
    expect(result.failure_categories.browser_failure).toBe(1);
    expect(result.failure_categories.unit_contract_failure).toBe(1);
  });

  it("does not turn cancelled CI into a stale-head incident", () => {
    const result = metrics(attempt(run(1, 1, "ci", {conclusion: "cancelled"})));
    expect(result.ci.cancelled).toBe(1);
    expect(result.failure_categories.cancelled).toBe(1);
    expect(result.stale_head_incidents.observed_attempts).toBe(0);
  });

  it("requires runtime log evidence for provider and stale-head signals", () => {
    const r = run(1, 1, "ci", {conclusion: "failure"});
    const jobs = [job(1, "E2E public smoke", 1, 10, {conclusion: "failure"})];
    expect(classifyAttempt(r, jobs, {1: 'echo "Machine-observed CodeRabbit availability failure; x"'})).toEqual(["unknown"]);
    expect(classifyAttempt(r, jobs, {1: at(2) + " Machine-observed CodeRabbit availability failure; exact-head fallback allowed."}))
      .toEqual(["provider_unavailable"]);
    expect(classifyAttempt(r, jobs, {1: at(2) + " Refused: gate head abc is stale; current PR head is def."})).toEqual(["stale_evidence"]);
  });

  it("reports queued zero-job historical runs as unknown, not active work", () => {
    const result = metrics(attempt(run(1, 1, "planner", {status: "queued", conclusion: null})));
    expect(result.planner).toMatchObject({success: 0, unknown: 1, model_executions: 0});
    expect(result.executed_jobs).toEqual([]);
    expect(result.failure_categories.unknown).toBe(1);
  });

  it("exposes partial jobs and missing attempts", () => {
    const result = metrics(attempt(run(1, 3), [job(1, "Build")],
      {jobs_complete: false, jobs: {total_count: 2, jobs: [job(1, "Build")]}}));
    expect(result.unknowns).toContain("run:1:attempt_history_incomplete");
    expect(result.unknowns).toContain("attempt:1:3:jobs_incomplete");
  });

  it("deduplicates input and produces identical output independent of ordering", () => {
    const input = sevenAttempts();
    const entry = (input.runs as {run: ReturnType<typeof run>; attempts: ReturnType<typeof attempt>[]}[])[0];
    const shuffled = structuredClone(entry);
    shuffled.attempts.reverse();
    for (const a of shuffled.attempts) a.jobs.jobs.reverse();
    expect(aggregateMetrics(evidence([shuffled, entry]))).toEqual(aggregateMetrics(input));
  });

  it("flags conflicting duplicate snapshots instead of choosing input order", () => {
    const a = {run: run(), attempts: [attempt(run())]};
    const b = {run: {...run(), conclusion: "failure"}, attempts: [attempt(run())]};
    const result = aggregateMetrics(evidence([a, b]));
    expect(result.ci.total).toBe(0);
    expect(result.unknowns).toContain("run:conflicting:1");
    expect(result).toEqual(aggregateMetrics(evidence([b, a])));
  });

  it("handles malformed jobs and invalid durations without NaN or invented time", () => {
    const a = attempt(run(), [job(1, "Build", 10, 1), null as unknown as ReturnType<typeof job>]);
    const result = metrics(a);
    expect(result.executed_job_seconds).toBe(0);
    expect(result.unknowns.some((s: string) => s.includes("duration_unknown"))).toBe(true);
    expect(() => aggregateMetrics({})).toThrow();
  });

  it("calculates the #915 fixture: 312 wall seconds and 568 summed job seconds", () => {
    const r = run(36743979865);
    const result = metrics(attempt(r, [
      job(1, "Build", 1, 101), job(2, "Unit and worker tests", 12, 312),
      job(3, "E2E public smoke run", 1, 101), job(4, "Static checks", 1, 69),
    ]));
    expect(result.attempts[0].wall_seconds).toBe(312);
    expect(result.executed_job_seconds).toBe(568);
    expect(result.time_to_green.runs[0].seconds).toBe(312);
  });

  it("leaves incomplete time-to-green unknown", () => {
    const result = metrics(attempt(run(1, 1, "ci", {conclusion: "failure"})));
    expect(result.time_to_green.runs[0]).toMatchObject({seconds: null, status: "unknown"});
  });

  it("counts repair execution separately from no-change outcomes", () => {
    const result = metrics(attempt(run(1, 1, "repair"), [
      job(1, "Batch current-head review findings", 1, 10, {steps: [step("Run one batched exact-head repair")]}),
    ], {logs: {1: at(8) + " No current valid review finding required a code change."}}));
    expect(result.repair_attempts).toMatchObject({executed: 1, no_change: 1, failed: 0});
  });

  it("never infers external review execution or duplicate Workers from green CI", () => {
    const result = metrics(attempt(run(), [job(1, "AI review route")]));
    expect(result.review_execution.actual_executions).toBeNull();
    expect(result.duplicate_worker_dispatches.count).toBeNull();
  });
  it("counts nested reusable Worker model execution within a planner run", () => {
    const result = metrics(attempt(run(1, 1, "planner"), [
      job(1, "Select one bounded next task", 1, 10, {steps: [step("Ask Codex for exactly one next bounded task")]}),
      job(2, "dispatch / Run bounded Codex Worker", 11, 20, {steps: [step("Run one bounded implementation Worker", "success", 12, 15)]}),
    ]));
    expect(result.model_execution.planner.executed).toBe(1);
    expect(result.model_execution.worker).toMatchObject({workflow_runs: 1, executed: 1, eligible_observed: 1});
  });

  it("counts a nested skipped Worker job separately from its successful planner", () => {
    const result = metrics(attempt(run(1, 1, "planner"), [
      job(1, "dispatch / Run bounded Codex Worker", 1, 1, {conclusion: "skipped"}),
    ]));
    expect(result.model_execution.worker).toMatchObject({workflow_runs: 1, executed: 0, skipped: 1});
  });

  it("does not confuse stale-head or infrastructure gate failures with review blockers", () => {
    const r = run(1, 1, "ci", {conclusion: "failure"});
    const jobs = [job(1, "E2E public smoke run"), job(2, "E2E public smoke", 11, 20, {conclusion: "failure"})];
    expect(classifyAttempt(r, jobs, {2: at(12) + " Refused: gate head abc is stale; current PR head is def."})).toEqual(["stale_evidence"]);
    expect(classifyAttempt(r, jobs, {2: at(12) + " Refused: AI review routing did not succeed (failure)."})).toEqual(["unknown"]);
    expect(classifyAttempt(r, jobs)).toEqual(["unknown"]);
  });

  it.each(["failure", "cancelled"])("counts a repair outcome of %s after a successful model step", (conclusion) => {
    const result = metrics(attempt(run(1, 1, "repair", {conclusion}), [
      job(1, "Batch current-head review findings", 1, 10, {steps: [step("Run one batched exact-head repair")]}),
      job(2, "Validate repair without model or push credentials", 11, 20, {conclusion}),
    ]));
    expect(result.repair_attempts).toMatchObject({executed: 1, [conclusion === "failure" ? "failed" : "cancelled"]: 1, outcome_unknown: 0});
  });

  it("includes the existing CI-autofix repair lane", () => {
    const result = metrics(attempt(run(1, 1, "repair", {path: ".github/workflows/proffera-ci-autofix.yml", conclusion: "failure"}), [
      job(1, "Bounded Codex CI autofix", 1, 10, {conclusion: "failure", steps: [step("Run one bounded Codex repair attempt")]}),
    ]));
    expect(result.repair_attempts).toMatchObject({executed: 1, failed: 1});
  });

  it("does not charge a cancelled job that never acquired a runner or executed a step", () => {
    const result = metrics(attempt(run(1, 1, "ci", {conclusion: "cancelled"}), [
      job(1, "Build", 1, 20, {runner_id: 0, conclusion: "cancelled"}),
    ]));
    expect(result.executed_job_seconds).toBe(0);
    expect(result.executed_jobs).toHaveLength(0);
  });

  it("keeps time-to-green unknown with missing intermediate attempts or job pages", () => {
    const first = attempt(run(1, 1, "ci", {conclusion: "failure"}), [job(1, "Build")]);
    const third = attempt(run(1, 3), [job(3, "Build", 2001, 2010)]);
    expect(aggregateMetrics(evidence([{run: third.run, attempts: [first, third]}])).time_to_green.runs[0].seconds).toBeNull();
    expect(metrics(attempt(run(), [job(1, "Build")], {jobs_complete: false})).time_to_green.runs[0].seconds).toBeNull();
  });

  it("counts an explicit stale refusal even when its workflow exits successfully", () => {
    const result = metrics(attempt(run(), [job(1, "E2E public smoke")],
      {logs: {1: at(5) + " Refused: gate head abc is stale; current PR head is def."}}));
    expect(result.stale_head_incidents.observed_attempts).toBe(1);
  });

  it("does not derive a green duration from jobs rejected by normalization", () => {
    for (const override of [{id: null}, {run_id: 999}, {name: null}, {head_sha: "b".repeat(40)}, {run_attempt: 2}]) {
      const result = metrics(attempt(run(), [job(1, "Build", 1, 15, override)]));
      expect(result.executed_jobs).toEqual([]);
      expect(result.attempts[0].wall_seconds).toBeNull();
      expect(result.time_to_green.runs[0]).toMatchObject({seconds: null, status: "unknown"});
    }
  });

  it("recognizes the existing CI-autofix no-change message", () => {
    const result = metrics(attempt(run(1, 1, "repair", {path: ".github/workflows/proffera-ci-autofix.yml"}), [
      job(1, "Bounded Codex CI autofix", 1, 10, {steps: [step("Run one bounded Codex repair attempt")]}),
    ], {logs: {1: at(7) + " Codex made no repository changes."}}));
    expect(result.repair_attempts).toMatchObject({executed: 1, no_change: 1, outcome_unknown: 0});
  });

});

describe("read-only bounded evidence acquisition", () => {
  it("reads every jobs page and attempt, and deduplicates requested run IDs", () => {
    const endpoints: string[] = [];
    const read = (endpoint: string) => {
      endpoints.push(endpoint);
      if (endpoint.endsWith("/runs/1")) return run();
      if (endpoint.endsWith("/attempts/1")) return run();
      const page = endpoint.endsWith("page=1") ? [job(1, "Build")] : [job(2, "Static checks")];
      return {total_count: 2, jobs: page};
    };
    const result = collectEvidence({runIds: [1, 1]}, read);
    expect(endpoints).toHaveLength(4);
    expect(endpoints.every((e) => e.startsWith("repos/ibboabdoli-ai/Proffera/actions/"))).toBe(true);
    expect(result.runs[0].attempts[0].jobs_complete).toBe(true);
  });

  it("marks missing pages, malformed responses and unavailable attempts explicitly", () => {
    const read = (endpoint: string) => {
      if (endpoint.endsWith("/runs/1")) return run(1, 2);
      if (endpoint.endsWith("/attempts/1")) return run();
      if (endpoint.endsWith("page=1")) return {total_count: 2, jobs: [job(1, "Build")]};
      throw new Error("Not available");
    };
    const result = collectEvidence({runIds: [1]}, read);
    expect(result.collection_errors).toEqual(["1:1:attempt_partial", "1:2:attempt_partial"]);
    expect(result.runs[0].attempts[0].jobs_complete).toBe(false);
    expect(aggregateMetrics(result).unknowns).toContain("attempt:1:1:jobs_incomplete");
  });

  it("rejects arbitrary endpoints/options before making a request", () => {
    const noRead = () => { throw new Error("Must not read"); };
    expect(() => collectEvidence({repository: "--method POST", runIds: [1]}, noRead)).toThrow("Provide owner/repo");
    expect(() => collectEvidence({runIds: [NaN]}, noRead)).toThrow("Provide owner/repo");
    expect(() => collectEvidence({runIds: Array(51).fill(1)}, noRead)).toThrow("Provide owner/repo");
  });

  it("detects repeated API pages rather than declaring completeness", () => {
    const read = (endpoint: string) => endpoint.endsWith("/runs/1") || endpoint.endsWith("/attempts/1")
      ? run() : {total_count: 2, jobs: [job(1, "Build")]};
    const result = collectEvidence({runIds: [1]}, read);
    expect(result.runs[0].attempts[0].jobs_complete).toBe(false);
    expect(result.collection_errors).toContain("1:1:jobs_partial");
  });
});
