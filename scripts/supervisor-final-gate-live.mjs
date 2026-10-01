#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  acceptFinalGateRetry,
  decideFinalGateRetry,
  ensureFinalGateMemory,
  finalGateMemoryIdentity,
  listFinalGateRetryIntents,
  markFinalGateUncertain,
  recoverAcceptedFinalGateIntent,
} from "./supervisor-final-gate-memory.mjs";

const MAX_PAGES = 100;
const isoNow = () => new Date().toISOString();

function gh(args, execute = execFileSync) {
  return execute("gh", ["api", "--hostname", "github.com", ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function ghJson(args, execute) {
  return JSON.parse(gh(args, execute));
}
function pages(endpoint, execute, selector = null) {
  const items = [];
  let expectedTotal = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const payload = ghJson([endpoint + (endpoint.includes("?") ? "&" : "?") + "per_page=100&page=" + page], execute);
    const current = selector ? payload?.[selector] : payload;
    if (!Array.isArray(current)) throw new Error("final_gate_live:pagination");
    if (selector) {
      if (!Number.isSafeInteger(payload?.total_count) || payload.total_count < 0) throw new Error("final_gate_live:pagination_total");
      if (expectedTotal === null) expectedTotal = payload.total_count;
      else if (payload.total_count !== expectedTotal) throw new Error("final_gate_live:pagination_changed");
    }
    items.push(...current);
    if (current.length < 100) {
      if (selector && items.length !== expectedTotal) throw new Error("final_gate_live:pagination_incomplete");
      return items;
    }
  }
  throw new Error("final_gate_live:pagination_bound");
}
function comments(repository, execute) {
  return pages("repos/" + repository + "/issues/548/comments", execute);
}
function memoryInput(input, completeComments) {
  return {
    repository: input.repository,
    pr_number: input.pr_number,
    comments: completeComments,
    comments_complete: true,
  };
}
function persist(repository, result, execute) {
  const persistence = result.persistence;
  if (!persistence) return;
  if (persistence.comment_id === null) {
    ghJson(["--method", "POST", "repos/" + repository + "/issues/548/comments", "-f", "body=" + persistence.body], execute);
  } else {
    ghJson(["--method", "PATCH", "repos/" + repository + "/issues/comments/" + persistence.comment_id, "-f", "body=" + persistence.body], execute);
  }
}
function verifyIdentity(input, expected, execute) {
  const actual = finalGateMemoryIdentity(memoryInput(input, comments(input.repository, execute))).identity;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("final_gate_live:persistence_identity");
}
function ensureV2(input, execute) {
  let all = comments(input.repository, execute);
  let result = ensureFinalGateMemory(memoryInput(input, all));
  if (result.action !== "none") {
    persist(input.repository, result, execute);
    all = comments(input.repository, execute);
    result = ensureFinalGateMemory(memoryInput(input, all));
    if (result.action !== "none") throw new Error("final_gate_live:v2_not_durable");
  }
  return all;
}
function fetchSource(input, execute) {
  if (input.source.kind === "issue_comment") {
    const value = ghJson(["repos/" + input.repository + "/issues/comments/" + input.source.id], execute);
    return {
      kind: "issue_comment",
      id: value.id,
      actor: value.user?.login ?? "",
      observed_at: value.updated_at ?? "",
      review_commit: null,
      body: value.body ?? "",
      review_state: "",
    };
  }
  const value = ghJson(["repos/" + input.repository + "/pulls/" + input.pr_number + "/reviews/" + input.source.id], execute);
  return {
    kind: "pull_request_review",
    id: value.id,
    actor: value.user?.login ?? "",
    observed_at: value.submitted_at ?? "",
    review_commit: value.commit_id ?? "",
    body: value.body ?? "",
    review_state: String(value.state ?? "").toLowerCase(),
  };
}
function sameSource(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function fetchPrHead(input, execute) {
  return String(ghJson(["repos/" + input.repository + "/pulls/" + input.pr_number], execute)?.head?.sha ?? "");
}
function fetchJob(input, execute) {
  const job = ghJson(["repos/" + input.repository + "/actions/jobs/" + input.target.job.id], execute);
  return {
    id: job.id,
    run_id: job.run_id,
    head: input.target.head,
    run_attempt: job.run_attempt,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
}
function fetchRecoveryForTarget(input, target, execute, observedAt) {
  const jobs = pages("repos/" + input.repository + "/actions/runs/" + target.run_id + "/jobs?filter=all", execute, "jobs");
  const finals = jobs.filter((job) => job.name === "E2E public smoke").map((job) => ({
    id: job.id,
    run_id: target.run_id,
    head: target.head,
    run_attempt: job.run_attempt,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
  }));
  const runAttempt = Math.max(0, ...finals.map((job) => Number(job.run_attempt) || 0));
  return {
    repository: input.repository,
    pr_number: input.pr_number,
    run_id: target.run_id,
    head: target.head,
    workflow_path: ".github/workflows/ci.yml",
    run_attempt: runAttempt,
    complete: true,
    observed_at: observedAt,
    jobs: finals,
  };
}
function fetchRecovery(input, execute, observedAt) {
  return fetchRecoveryForTarget(input, input.target, execute, observedAt);
}
function recoverAcceptedIntents(input, execute, now) {
  let all = comments(input.repository, execute);
  const accepted = listFinalGateRetryIntents(memoryInput(input, all)).filter((intent) => intent.state === "ACCEPTED");
  for (const candidate of accepted) {
    all = comments(input.repository, execute);
    const current = listFinalGateRetryIntents(memoryInput(input, all)).find((intent) => intent.id === candidate.id);
    if (!current || current.state !== "ACCEPTED") continue;
    const result = recoverAcceptedFinalGateIntent({
      ...memoryInput(input, all),
      intent_id: current.id,
      recovery_evidence: fetchRecoveryForTarget(input, current.target, execute, now()),
    });
    if (result.decision === "FAIL_CLOSED_MISMATCH") throw new Error("final_gate_live:accepted_recovery_mismatch");
    if (result.persistence) {
      persist(input.repository, result, execute);
      verifyIdentity(input, result.persistence.identity, execute);
    }
  }
  return comments(input.repository, execute);
}

function coderabbitStillClean(input, execute) {
  if (!input.require_coderabbit_clean_guard) return true;
  const reviews = pages("repos/" + input.repository + "/pulls/" + input.pr_number + "/reviews", execute)
    .filter((review) => review.user?.login === "coderabbitai[bot]" && review.commit_id === input.target.head);
  const changes = reviews.filter((r) => r.state === "CHANGES_REQUESTED").map((r) => r.submitted_at ?? "").sort().at(-1) ?? "";
  const approvals = reviews.filter((r) => r.state === "APPROVED").map((r) => r.submitted_at ?? "").sort().at(-1) ?? "";
  return !changes || (approvals && approvals > changes);
}
function markUncertain(input, intentId, reason, execute, now) {
  const all = comments(input.repository, execute);
  const result = markFinalGateUncertain({
    ...memoryInput(input, all),
    intent_id: intentId,
    reason,
    observed_at: now(),
  });
  persist(input.repository, result, execute);
  verifyIdentity(input, result.persistence.identity, execute);
}
function failBeforePost(input, intentId, reason, execute, now) {
  // PREPARED was already durable. No POST has occurred in this serialized writer,
  // so make the fail-closed state explicit. Equivalent evidence remains blocked;
  // materially changed exact-head evidence receives a distinct intent identity.
  markUncertain(input, intentId, "insufficient_evidence", execute, now);
  return { decision: "FAIL_CLOSED_MISMATCH", intent_id: intentId, reason };
}

function postRerun(input, execute) {
  try {
    const text = gh(["--include", "--method", "POST", "repos/" + input.repository + "/actions/jobs/" + input.target.job.id + "/rerun"], execute);
    return /^HTTP\/[0-9.]+ 201(?:\s|$)/m.test(text) ? { accepted: true } : { accepted: false, definite: false };
  } catch (error) {
    const text = String(error?.stdout ?? "") + "\n" + String(error?.stderr ?? "");
    return { accepted: false, definite: /^HTTP\/[0-9.]+ (?:4|5)[0-9][0-9](?:\s|$)/m.test(text) };
  }
}

export function runLiveFinalGate(input, execute = execFileSync, now = isoNow) {
  if (!input || input.repository !== "ibboabdoli-ai/Proffera" || !Number.isSafeInteger(input.pr_number)) {
    throw new Error("final_gate_live:input");
  }

  const initialSource = fetchSource(input, execute);
  if (!sameSource(initialSource, input.source)) throw new Error("final_gate_live:source_changed");
  if (fetchPrHead(input, execute) !== input.target.head) throw new Error("final_gate_live:head_changed");
  const initialJob = fetchJob(input, execute);
  if (JSON.stringify(initialJob) !== JSON.stringify(input.target.job)) throw new Error("final_gate_live:job_changed");

  ensureV2(input, execute);
  let all = recoverAcceptedIntents(input, execute, now);
  const decision = decideFinalGateRetry({
    ...memoryInput(input, all),
    target: input.target,
    source: input.source,
    prepared_at: now(),
    recovery_evidence: fetchRecovery(input, execute, now()),
  });

  if (decision.persistence) {
    persist(input.repository, decision, execute);
    verifyIdentity(input, decision.persistence.identity, execute);
  }
  if (decision.decision !== "ALLOW_RERUN") return decision;

  const currentSource = fetchSource(input, execute);
  if (!sameSource(currentSource, input.source)) return failBeforePost(input, decision.intent_id, "source_changed", execute, now);
  if (fetchPrHead(input, execute) !== input.target.head) return failBeforePost(input, decision.intent_id, "head_changed", execute, now);
  const currentJob = fetchJob(input, execute);
  if (JSON.stringify(currentJob) !== JSON.stringify(input.target.job)) return failBeforePost(input, decision.intent_id, "job_changed", execute, now);
  const currentRecovery = fetchRecovery(input, execute, now());
  if (currentRecovery.run_attempt !== input.target.run_attempt) {
    return failBeforePost(input, decision.intent_id, "run_attempt_changed", execute, now);
  }
  if (!coderabbitStillClean(input, execute)) return failBeforePost(input, decision.intent_id, "review_changed", execute, now);

  const posted = postRerun(input, execute);
  if (!posted.accepted) {
    markUncertain(input, decision.intent_id, posted.definite ? "post_failed" : "acceptance_unknown", execute, now);
    return { decision: "FAIL_CLOSED_UNCERTAIN", intent_id: decision.intent_id };
  }

  all = comments(input.repository, execute);
  const accepted = acceptFinalGateRetry({
    ...memoryInput(input, all),
    intent_id: decision.intent_id,
    receipt: {
      http_status: 201,
      binding_digest: decision.binding_digest,
      observed_at: now(),
    },
  });
  persist(input.repository, accepted, execute);
  verifyIdentity(input, accepted.persistence.identity, execute);
  return { decision: "ALLOW_RERUN", intent_id: decision.intent_id, state: "ACCEPTED" };
}

function main(argv) {
  if (argv.length !== 1) throw new Error("usage");
  const input = JSON.parse(readFileSync(argv[0], "utf8"));
  process.stdout.write(JSON.stringify(runLiveFinalGate(input)));
}
if (process.argv[1]?.endsWith("supervisor-final-gate-live.mjs")) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "final_gate_live:error");
    process.exitCode = 1;
  }
}
