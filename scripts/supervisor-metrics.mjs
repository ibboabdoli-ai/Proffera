#!/usr/bin/env node
/**
 * A1 observation only. No orchestration imports, writes, retries or model calls.
 *
 * Offline: node scripts/supervisor-metrics.mjs --input evidence.json
 * Live:    node scripts/supervisor-metrics.mjs --runs 36761809827,36622937789 [--logs]
 *          [--repository owner/repo]
 *
 * Evidence v1: {schema_version:1, repository, runs:[{run:<Actions run>,
 * attempts:[{run:<Actions attempt>, jobs:{total_count,jobs:[<Actions job>]},
 * jobs_complete:true, logs?:{[jobId]:<raw log>},
 * blocking_evidence?:{[jobId]:{head_sha,captured_at,complete:true,items:[...]}}}]}]}.
 * Blocking items are the complete contemporaneous review/thread records, including
 * immutable IDs and their state/update times; an empty/partial snapshot proves nothing.
 * Live collection deliberately does not reconstruct historical review snapshots.
 *
 * Totals describe only supplied runs; they are never a repository-wide census.
 * Counts are observed lower bounds when unknowns is nonempty. Step executions
 * measure invocation attempts, NOT billable API requests/tokens. Eligibility is
 * known only when execution is observed; a skipped step does not explain why.
 * Job identity uses run/name/start/end, not job ID or run_attempt: GitHub clones
 * inherited jobs with fresh IDs and attempt numbers but original timestamps.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const PATHS = {
  planner: ".github/workflows/supervisor-planner.yml",
  ci: ".github/workflows/ci.yml",
  repair: ".github/workflows/supervisor-review-repair.yml",
  worker: ".github/workflows/supervisor-worker-handoff.yml",
};
const MODEL_STEPS = {
  planner: ["Ask Codex for exactly one next bounded task"],
  worker: ["Run one bounded implementation Worker"],
  repair: ["Run one batched exact-head repair", "Run one bounded Codex repair attempt"],
};
const MODEL_JOBS = {
  planner: ["Select one bounded next task"],
  worker: ["Run bounded Codex Worker"],
  repair: ["Batch current-head review findings", "Bounded Codex CI autofix"],
};
const GATE = "E2E public smoke";
const BROWSER = "E2E public smoke run";
const CATEGORIES = ["workflow_invalid", "browser_failure", "unit_contract_failure",
  "review_blocked", "provider_unavailable", "stale_evidence", "cancelled", "unknown"];
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v) => Number.isSafeInteger(v) && v > 0;
const sha = (v) => typeof v === "string" && /^[a-f0-9]{40}$/i.test(v);
const validRepository = (v) => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(v);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const canonical = (v) => JSON.stringify(v, (_key, value) =>
  Array.isArray(value) ? [...value].sort((a, b) => compare(canonical(a), canonical(b)))
    : record(value) ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]])) : value);
const digest = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const time = (v) => typeof v === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(v)
  && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
const seconds = (start, end) => {
  const a = time(start), b = time(end);
  return a !== null && b !== null && b >= a ? (b - a) / 1000 : null;
};
const named = (job, name) => job.name === name || job.name?.endsWith(" / " + name);
const ran = (v) => v?.conclusion !== "skipped" && time(v?.started_at) !== null
  && (v.status === "in_progress" || (v.status === "completed" && ["success", "failure", "cancelled", "timed_out", "neutral", "action_required"].includes(v.conclusion)));
const executedJob = (job) => ran(job) && (integer(job.runner_id) || (Array.isArray(job.steps) && job.steps.some(ran)));
const executionKey = (runId, job) => canonical([runId, job.name, time(job.started_at), time(job.completed_at)]);
const emptyStates = () => ({total: 0, success: 0, failure: 0, cancelled: 0, startup_failure: 0, unknown: 0});
function addState(counts, run) {
  counts.total++;
  const state = run.status === "completed" && Object.hasOwn(counts, run.conclusion)
    && !["total", "unknown"].includes(run.conclusion) ? run.conclusion : "unknown";
  counts[state]++;
}

// Only anchored runtime messages are recognized: echoed source in Actions log
// preambles must not be mistaken for an executed failure branch.
const validJob = (job, run) => record(job) && integer(job.id) && typeof job.name === "string" && job.name.length > 0
  && (job.run_id === undefined || job.run_id === run.id)
  && (job.run_attempt === undefined || job.run_attempt === run.run_attempt)
  && (job.head_sha === undefined || job.head_sha === run.head_sha);

function completion(attempt) {
  const jobs = attempt.jobs?.jobs;
  if (attempt.jobs_complete !== true || !Array.isArray(jobs) || jobs.length !== attempt.jobs.total_count
    || new Set(jobs.map((j) => j?.id)).size !== jobs.length
    || jobs.some((j) => !validJob(j, attempt.run) || j.status !== "completed")) return null;
  const executed = jobs.filter((j) => j.conclusion !== "skipped");
  if (!executed.length || executed.some((j) => !executedJob(j) || seconds(j.started_at, j.completed_at) === null)) return null;
  return new Date(Math.max(...executed.map((j) => time(j.completed_at)))).toISOString();
}

function signals(log) {
  if (typeof log !== "string") return [];
  const lines = log.split(/\r?\n/).map((line) =>
    line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s+/, "").replace(/\u001b\[[0-9;]*m/g, ""));
  const result = new Set();
  for (const line of lines) {
    if (/^Refused: (?:CI head |gate head |review gate became stale;|clean CodeRabbit comment became stale;|Codex fallback became stale;)/.test(line))
      result.add("stale_evidence");
    if (/^(?:Machine-observed CodeRabbit availability failure;|CodeRabbit (?:high-risk )?availability timeout reached;)/.test(line))
      result.add("provider_unavailable");
    if (/^(?:Refused: no acceptable CodeRabbit|Refused: risk-routed PR needs one final AI review|CodeRabbit changes remain requested for current head;|CodeRabbit posted current-head review findings; refusing review acceptance\.|Codex fallback posted current-head review findings;)/.test(line))
      result.add("review_blocked");
    if (line === "No current valid review finding required a code change." || line === "Codex made no repository changes.") result.add("no_change");
  }
  return [...result].sort();
}

export function classifyAttempt(run, jobs, logs = {}) {
  if (run.conclusion === "startup_failure") return ["workflow_invalid"];
  if (run.conclusion === "cancelled") return ["cancelled"];
  if (run.status !== "completed") return ["unknown"];
  if (run.conclusion === "success") return [];
  const categories = new Set();
  for (const job of jobs) {
    if (!executedJob(job)) continue;
    for (const signal of signals(logs[job.id])) {
      if (signal !== "no_change") categories.add(signal);
    }
    if (job.conclusion !== "failure" && job.conclusion !== "timed_out") continue;
    const failedStep = (name) => Array.isArray(job.steps) && job.steps.some((step) =>
      step?.name === name && ran(step) && ["failure", "timed_out"].includes(step.conclusion));
    if (named(job, BROWSER) && failedStep("Run non-destructive public smoke tests")) categories.add("browser_failure");
    if (named(job, "Unit and worker tests") && (failedStep("Test") || failedStep("Validate discovery worker")))
      categories.add("unit_contract_failure");
  }
  return categories.size ? [...categories].sort() : ["unknown"];
}

function unique(values, keyOf, unknown, label) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (key === null) { unknown.add(label + ":malformed:" + digest(value)); continue; }
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key).set(canonical(value), value);
  }
  return [...groups.entries()].sort(([a], [b]) => compare(a, b)).flatMap(([key, variants]) => {
    if (variants.size > 1) { unknown.add(label + ":conflicting:" + key); return []; }
    return [...variants.values()];
  });
}

export function aggregateMetrics(evidence) {
  if (!record(evidence) || evidence.schema_version !== 1 || !Array.isArray(evidence.runs)
    || !validRepository(evidence.repository))
    throw new Error("Expected evidence v1 with repository and runs array");
  const unknown = new Set();
  if (evidence.collection_errors !== undefined && !Array.isArray(evidence.collection_errors)) throw new Error("Invalid collection errors");
  for (const error of evidence.collection_errors ?? []) unknown.add("collection:" + String(error));
  const runs = unique(evidence.runs, (entry) => integer(entry?.run?.id) ? String(entry.run.id) : null, unknown, "run");
  const planner = emptyStates(), ci = {...emptyStates(), attempts: 0};
  const failure_categories = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const execution = Object.fromEntries(Object.keys(MODEL_STEPS).map((kind) => [kind, {
    workflow_runs: 0, eligible_observed: 0, executed: 0, skipped: 0, unknown: 0,
  }]));
  const roleRuns = Object.fromEntries(Object.keys(MODEL_STEPS).map((role) => [role, new Set()]));
  const jobsSeen = new Map(), stepsSeen = new Set(), gates = [], attemptResults = [], green = [];
  const staleAttempts = new Set();
  const repair = {executed: 0, no_change: 0, failed: 0, cancelled: 0, outcome_unknown: 0};
  let jobSeconds = 0;
  for (const entry of runs) {
    const latest = entry.run;
    const kind = latest.path === ".github/workflows/proffera-ci-autofix.yml" ? "repair"
      : Object.keys(PATHS).find((k) => PATHS[k] === latest.path);
    if (!kind || !sha(latest.head_sha) || (latest.repository?.full_name !== undefined && latest.repository.full_name !== evidence.repository)) { unknown.add("run:" + latest.id + ":workflow_or_head_unknown"); continue; }
    if (kind === "planner") addState(planner, latest);
    if (kind === "ci") addState(ci, latest);
    if (execution[kind]) roleRuns[kind].add(latest.id);
    const attempts = unique(Array.isArray(entry.attempts) ? entry.attempts : [],
      (a) => integer(a?.run?.run_attempt) ? String(a.run.run_attempt).padStart(5, "0") : null, unknown, "attempt:" + latest.id)
      .filter((a) => {
        const valid = a.run.id === latest.id && a.run.head_sha === latest.head_sha && a.run.path === latest.path;
        if (!valid) unknown.add("run:" + latest.id + ":attempt_binding_invalid");
        return valid;
      });
    if (!integer(latest.run_attempt) || attempts.length !== latest.run_attempt
      || attempts.some((a, i) => a.run.run_attempt !== i + 1))
      unknown.add("run:" + latest.id + ":attempt_history_incomplete");
    for (const attempt of attempts) {
      const run = attempt.run, ref = latest.id + ":" + run.run_attempt;
      if (kind === "ci") ci.attempts++;
      const rawJobs = Array.isArray(attempt.jobs?.jobs) ? attempt.jobs.jobs : [];
      const jobs = unique(rawJobs, (job) => validJob(job, run) ? String(job.id) : null, unknown, "jobs:" + ref);
      const complete = attempt.jobs_complete === true && Number.isSafeInteger(attempt.jobs?.total_count)
        && attempt.jobs.total_count >= 0 && jobs.length === attempt.jobs.total_count;
      if (!complete) unknown.add("attempt:" + ref + ":jobs_incomplete");
      const categories = classifyAttempt(run, jobs, record(attempt.logs) ? attempt.logs : {});
      for (const category of categories) failure_categories[category]++;
      if (categories.includes("unknown")) unknown.add("attempt:" + ref + ":classification_unknown");
      const result = {run_id: latest.id, attempt: run.run_attempt, head_sha: latest.head_sha,
        categories, observed_job_seconds: 0, wall_seconds: run.status === "completed"
          ? seconds(run.run_started_at, completion(attempt)) : null};
      const attemptStart = time(run.run_started_at);
      const localKeys = new Map();
      let repairExecuted = false, repairNoChange = false;
      const seenRoles = new Set();
      for (const job of jobs) {
        const role = Object.keys(MODEL_JOBS).find((r) => MODEL_JOBS[r].some((name) => named(job, name)));
        if (role) { roleRuns[role].add(latest.id); seenRoles.add(role); }
        if (job.conclusion === "skipped") {
          if (role) {
            const key = canonical([latest.id, job.name, run.run_attempt, "skipped"]);
            if (!stepsSeen.has(key)) { execution[role].skipped++; stepsSeen.add(key); }
          }
          continue;
        }
        if (!executedJob(job)) { unknown.add("job:" + ref + ":" + job.id + ":execution_unknown"); continue; }
        const duration = seconds(job.started_at, job.completed_at);
        const key = executionKey(latest.id, job);
        localKeys.set(key, (localKeys.get(key) ?? 0) + 1);
        if (localKeys.get(key) > 1) { unknown.add("job:" + ref + ":ambiguous_execution_identity"); continue; }
        const inherited = attemptStart !== null && time(job.started_at) < attemptStart;
        if (inherited && !jobsSeen.has(key)) unknown.add("job:" + ref + ":inherited_without_original");
        if (!jobsSeen.has(key)) {
          jobsSeen.set(key, {run_id: latest.id, name: job.name, started_at: job.started_at,
            completed_at: job.completed_at ?? null, seconds: duration, inherited_only: inherited});
          if (duration !== null) { jobSeconds += duration; if (!inherited) result.observed_job_seconds += duration; }
          else unknown.add("job:" + ref + ":" + job.id + ":duration_unknown");
        }
        // Inherited jobs are evidence of an earlier execution, not this attempt.
        if (inherited) continue;
        if (signals(attempt.logs?.[job.id]).includes("stale_evidence")) staleAttempts.add(ref);
        if (named(job, GATE)) {
          const prs = Array.isArray(run.pull_requests) ? run.pull_requests.filter((p) =>
            integer(p?.number) && p.head?.sha === latest.head_sha) : [];
          const pr = prs.length === 1 ? prs[0].number : null;
          if (pr === null) unknown.add("gate:" + ref + ":pr_binding_unknown");
          const snapshot = attempt.blocking_evidence?.[job.id];
          const captured = time(snapshot?.captured_at);
          const blocked = ["failure", "timed_out"].includes(job.conclusion);
          const validSnapshot = blocked && snapshot?.complete === true && snapshot.head_sha === latest.head_sha
            && Array.isArray(snapshot.items) && snapshot.items.length > 0
            && snapshot.items.every((item) => record(item) && integer(item.id)
              && typeof item.state === "string" && time(item.updated_at) !== null)
            && captured !== null && captured >= time(job.started_at)
            && time(job.completed_at) !== null && captured <= time(job.completed_at);
          gates.push({key, run_id: latest.id, pr, blocked, head_sha: latest.head_sha, started_at: job.started_at,
            blocking_fingerprint: validSnapshot ? digest(snapshot.items) : null});
        }
        if (role) {
          const matches = Array.isArray(job.steps) ? job.steps.filter((step) => MODEL_STEPS[role].includes(step?.name)) : [];
          if (!matches.length) { execution[role].unknown++; unknown.add("job:" + ref + ":" + job.id + ":model_step_unobserved"); }
          for (const step of matches) {
            const stepKey = canonical([latest.id, job.name, time(job.started_at), step.name, time(step.started_at), step.conclusion]);
            if (stepsSeen.has(stepKey)) continue;
            stepsSeen.add(stepKey);
            if (step.conclusion === "skipped") execution[role].skipped++;
            else if (ran(step)) {
              execution[role].executed++; execution[role].eligible_observed++;
              if (role === "repair") {
                repairExecuted = true;
                repairNoChange ||= signals(attempt.logs?.[job.id]).includes("no_change");
              }
            } else { execution[role].unknown++; unknown.add("step:" + ref + ":execution_unknown"); }
          }
        }
      }
      if (execution[kind] && !seenRoles.has(kind)) {
        execution[kind].unknown++;
        unknown.add("attempt:" + ref + ":model_step_unobserved");
      }
      if (repairExecuted) {
        repair.executed++;
        if (run.conclusion === "failure" || run.conclusion === "timed_out") repair.failed++;
        else if (run.conclusion === "cancelled") repair.cancelled++;
        else if (run.conclusion === "success" && repairNoChange) repair.no_change++;
        else repair.outcome_unknown++;
      }
      attemptResults.push(result);
    }
    if (kind === "ci") {
      const start = attempts.find((a) => a.run.run_attempt === 1)?.run.run_started_at;
      const success = attempts.find((a) => a.run.status === "completed" && a.run.conclusion === "success");
      const prefixComplete = success && attempts.filter((a) => a.run.run_attempt <= success.run.run_attempt)
        .every((a, i) => a.run.run_attempt === i + 1) && attempts.filter((a) => a.run.run_attempt <= success.run.run_attempt).length === success.run.run_attempt;
      const end = success ? completion(success) : null;
      const duration = prefixComplete ? seconds(start, end) : null;
      green.push({run_id: latest.id, head_sha: latest.head_sha, seconds: duration,
        start: start ?? null, end,
        status: duration === null ? "unknown" : "observed"});
      if (duration === null) unknown.add("run:" + latest.id + ":time_to_green_incomplete");
    }
  }
  const uniqueGates = [...new Map(gates.map((gate) => [gate.key, gate])).values()]
    .sort((a, b) => compare(a.started_at, b.started_at) || compare(a.key, b.key));
  const groups = new Map(), blocking = new Map();
  const runHeads = new Set();
  let repeatedRunHead = 0;
  for (const gate of uniqueGates) {
    const runHead = canonical([gate.run_id, gate.head_sha]);
    if (runHeads.has(runHead)) repeatedRunHead++;
    runHeads.add(runHead);
  }
  const prUnknown = uniqueGates.filter((g) => g.pr === null).length;
  let repeated = 0, unchanged = 0, blockingUnknown = 0;
  for (const gate of uniqueGates) {
    if (gate.pr === null) continue;
    const group = canonical([gate.pr, gate.head_sha]);
    if (groups.has(group)) {
      repeated++;
      const prior = blocking.get(group);
      if (gate.blocked && prior?.blocked) {
        if (gate.blocking_fingerprint && prior.blocking_fingerprint === gate.blocking_fingerprint) unchanged++;
        else if (!gate.blocking_fingerprint || !prior.blocking_fingerprint) blockingUnknown++;
      }
    }
    groups.set(group, true);
    blocking.set(group, gate);
  }
  if (blockingUnknown) unknown.add("final_gate:blocking_snapshots_incomplete");
  unknown.add("external_reviews:provider_execution_not_observable_from_actions");
  unknown.add("duplicate_worker_dispatches:task_identity_and_dispatch_events_not_collected");
  for (const role of Object.keys(execution)) {
    execution[role].workflow_runs = roleRuns[role].size;
    execution[role].eligibility_unknown = execution[role].skipped + execution[role].unknown;
  }
  const observedJobs = [...jobsSeen.values()].sort((a, b) => compare(canonical(a), canonical(b)));
  return {
    schema_version: 1, repository: evidence.repository,
    measurement: "Observed evidence only; inspect unknowns before treating any count as complete.",
    window: {scope: "explicit_run_ids", run_ids: runs.map((r) => r.run.id).sort((a, b) => a - b)},
    planner: {...planner, model_executions: execution.planner.executed},
    ci, failure_categories, attempts: attemptResults,
    final_gate: {total_attempts: uniqueGates.length, repeated_run_head_attempts: repeatedRunHead,
      repeated_pr_head_attempts: prUnknown ? null : repeated, repeated_pr_head_attempts_observed: repeated,
      pr_binding_unknown: prUnknown,
      unchanged_blocking_evidence_observed: unchanged,
      unchanged_blocking_evidence_unknown: blockingUnknown},
    executed_job_seconds: jobSeconds, executed_jobs: observedJobs,
    model_execution: {unit: "observed_action_step_invocations_not_billable_calls", ...execution},
    review_execution: {workflow_eligibility: null, actual_executions: null, skipped: null,
      reason: "External review execution is not established by CI or AI review route success."},
    repair_attempts: repair,
    time_to_green: {definition: "Per CI run: first attempt start to last executed job completion in the first successful attempt, requiring complete job/attempt evidence; includes waits and reruns, not PR delivery time.", runs: green},
    duplicate_worker_dispatches: {count: null, reason: "No complete task-bound dispatch event history."},
    stale_head_incidents: {observed_attempts: staleAttempts.size,
      completeness: "Requires retained explicit stale-head refusal log; cancellation alone is not evidence."},
    unknowns: [...unknown].sort(),
  };
}

// Fixed GET-only adapter. No shared orchestration helper is imported: its CLI
// includes mutation capabilities, while this module only needs bounded reads.
export function githubRead(endpoint, raw = false) {
  const text = execFileSync("gh", ["api", "--hostname", "github.com", "--method", "GET", ...(raw ? ["--allow-escape-sequences"] : []), endpoint],
    {encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 60000, stdio: ["ignore", "pipe", "pipe"]});
  return raw ? text : JSON.parse(text);
}

export function collectEvidence({repository = "ibboabdoli-ai/Proffera", runIds, logs = false}, read = githubRead) {
  if (!validRepository(repository) || !Array.isArray(runIds) || !runIds.length
    || runIds.length > 50 || runIds.some((id) => !integer(id))) throw new Error("Provide owner/repo and 1–50 positive safe integer run IDs");
  const evidence = {schema_version: 1, repository, runs: [], collection_errors: []};
  const base = "repos/" + repository + "/actions";
  for (const id of [...new Set(runIds)].sort((a, b) => a - b)) {
    try {
      const run = read(base + "/runs/" + id);
      if (run?.id !== id || !integer(run.run_attempt) || run.run_attempt > 100) throw new Error("Invalid run");
      const entry = {run, attempts: []};
      evidence.runs.push(entry);
      for (let n = 1; n <= run.run_attempt; n++) {
        try {
          const attemptRun = read(base + "/runs/" + id + "/attempts/" + n);
          if (attemptRun?.id !== id || attemptRun.run_attempt !== n) throw new Error("Invalid attempt");
          const attempt = {run: attemptRun, jobs: {total_count: null, jobs: []}, jobs_complete: false, logs: {}};
          entry.attempts.push(attempt);
          for (let page = 1; page <= 50; page++) {
            const data = read(base + "/runs/" + id + "/attempts/" + n + "/jobs?per_page=100&page=" + page);
            if (!Array.isArray(data?.jobs) || !Number.isSafeInteger(data.total_count) || data.total_count < 0
              || (attempt.jobs.total_count !== null && attempt.jobs.total_count !== data.total_count)) throw new Error("Invalid page");
            attempt.jobs.total_count = data.total_count;
            attempt.jobs.jobs.push(...data.jobs);
            if (attempt.jobs.jobs.length >= data.total_count || data.jobs.length === 0) {
              attempt.jobs_complete = attempt.jobs.jobs.length === data.total_count
                && new Set(attempt.jobs.jobs.map((j) => j?.id)).size === data.total_count;
              break;
            }
          }
          if (!attempt.jobs_complete) evidence.collection_errors.push(id + ":" + n + ":jobs_partial");
          if (logs) for (const job of attempt.jobs.jobs) {
            if (!integer(job?.id) || !executedJob(job) || time(job.started_at) < time(attemptRun.run_started_at)
              || !(named(job, GATE) || MODEL_JOBS.repair.some((name) => named(job, name)))) continue;
            try { attempt.logs[job.id] = read(base + "/jobs/" + job.id + "/logs", true); }
            catch { evidence.collection_errors.push(id + ":" + n + ":" + job.id + ":log_unavailable"); }
          }
        } catch { evidence.collection_errors.push(id + ":" + n + ":attempt_partial"); }
      }
    } catch { evidence.collection_errors.push(id + ":run_unavailable_or_malformed"); }
  }
  return evidence;
}

function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: supervisor-metrics.mjs --input evidence.json | --runs id,id [--repository owner/repo] [--logs]\nEvidence/output schema version: 1. Explicit runs only; unknowns and nulls are not zeros.");
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!["--input", "--runs", "--repository", "--logs"].includes(arg) || Object.hasOwn(options, arg))
      throw new Error("Unknown or duplicate option");
    if (arg === "--logs") options[arg] = true;
    else if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing option value");
    else options[arg] = args[++i];
  }
  if (Boolean(options["--input"]) === Boolean(options["--runs"])
    || (options["--input"] && (options["--repository"] || options["--logs"]))) throw new Error("Choose offline input or live run IDs");
  const evidence = options["--input"] ? JSON.parse(readFileSync(options["--input"], "utf8"))
    : collectEvidence({repository: options["--repository"],
      runIds: options["--runs"].split(",").map((id) => /^\d+$/.test(id) ? Number(id) : NaN),
      logs: options["--logs"] === true});
  console.log(JSON.stringify(aggregateMetrics(evidence), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch { console.error("Metrics collection failed: invalid input or unavailable evidence. No writes performed."); process.exitCode = 1; }
}
