import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  acceptFinalGateRetry,
  cleanCodeRabbitComment,
  decideFinalGateRetry,
  ensureFinalGateMemory,
  finalGateMemoryIdentity,
  listFinalGateRetryIntents,
  markFinalGateUncertain,
  normalizeFinalGateEvidence,
  providerUnavailable,
  recoverAcceptedFinalGateIntent,
  releaseFinalGatePreparedIntent,
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
    if (items.some((item) => !Number.isSafeInteger(item?.id) || item.id <= 0)
      || new Set(items.map((item) => item.id)).size !== items.length) throw new Error("final_gate_live:pagination_identity");
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
    if (value.issue_url !== `https://api.github.com/repos/${input.repository}/issues/${input.pr_number}`) throw new Error("final_gate_live:source_scope");
    return {
      kind: "issue_comment",
      id: value.id,
      actor: value.user?.login ?? "",
      observed_at: value.updated_at ?? "",
      created_at: value.created_at ?? "",
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
  const core = (value) => ({
    kind: value?.kind,
    id: value?.id,
    actor: value?.actor,
    observed_at: value?.observed_at,
    review_commit: value?.review_commit,
    body: value?.body,
    review_state: value?.review_state,
  });
  return JSON.stringify(core(a)) === JSON.stringify(core(b));
}
function fetchPrHead(input, execute) {
  const pr = ghJson(["repos/" + input.repository + "/pulls/" + input.pr_number], execute);
  if (pr.number !== input.pr_number || pr.state !== "open" || pr.draft !== false
    || pr.base?.repo?.full_name !== input.repository) throw new Error("final_gate_live:pr_scope");
  return String(pr.head?.sha ?? "");
}
function includedResponse(text) {
  const match = String(text ?? "").match(/^HTTP\/[0-9.]+ (\d{3})[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*)$/);
  if (!match) throw new Error("final_gate_live:historical_response");
  return {status: Number(match[1]), body: JSON.parse(match[2])};
}
function historicalRun(endpoint, execute) {
  let response;
  try {
    response = gh(["--include", endpoint], execute);
  } catch (error) {
    // The current target has already proved Actions read access in this repository.
    // Isolate only an explicit unavailable historical resource, never permission,
    // transport, malformed response, pagination or identity failures. No state is
    // deleted or consumed; the unresolved target still owns its execution lock.
    if (!String(error?.stdout ?? "").trim()) throw error;
    const unavailable = includedResponse(error?.stdout);
    if ((unavailable.status === 404 && unavailable.body?.message === "Not Found")
      || (unavailable.status === 410 && unavailable.body?.message === "Gone")) return null;
    throw error;
  }
  const result = includedResponse(response);
  if (result.status !== 200) throw new Error("final_gate_live:historical_status");
  if (!result.body || typeof result.body !== "object" || Array.isArray(result.body)) throw new Error("final_gate_live:historical_response");
  return result.body;
}
function fetchRun(input, target, execute, historical = false) {
  const endpoint = `repos/${input.repository}/actions/runs/${target.run_id}`;
  const run = historical ? historicalRun(endpoint, execute) : ghJson([endpoint], execute);
  if (historical && run === null) return null;
  if (run.id !== target.run_id || run.head_sha !== target.head || run.path !== target.workflow_path
    || run.repository?.full_name !== input.repository || run.event !== "pull_request"
    || !Array.isArray(run.pull_requests) || !run.pull_requests.some((pr) => pr.number === input.pr_number)
    || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < target.run_attempt) throw new Error("final_gate_live:run_identity");
  return run;
}
function jobFromRun(job, run) {
  if (job.run_id !== run.id || (job.head_sha !== undefined && job.head_sha !== run.head_sha)
    || !Number.isSafeInteger(job.id) || job.id <= 0
    || !Number.isSafeInteger(job.run_attempt) || job.run_attempt < 1 || job.run_attempt > run.run_attempt) throw new Error("final_gate_live:job_identity");
  return {
    id: job.id,
    run_id: job.run_id,
    head: run.head_sha,
    run_attempt: job.run_attempt,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
}
function fetchJob(input, execute) {
  const run = fetchRun(input, input.target, execute);
  const job = ghJson(["repos/" + input.repository + "/actions/jobs/" + input.target.job.id], execute);
  return jobFromRun(job, run);
}
function fetchRecoveryForTarget(input, target, execute, observedAt, historical = false) {
  const run = fetchRun(input, target, execute, historical);
  if (run === null) return null;
  const jobs = pages("repos/" + input.repository + "/actions/runs/" + target.run_id + "/jobs?filter=all", execute, "jobs");
  const finals = jobs.map((job) => jobFromRun(job, run)).filter((job) => job.name === "E2E public smoke");
  const reread = fetchRun(input, target, execute, historical);
  if (reread === null) return null;
  if (reread.run_attempt !== run.run_attempt) throw new Error("final_gate_live:run_changed_during_pagination");
  return {
    repository: run.repository.full_name,
    pr_number: input.pr_number,
    run_id: run.id,
    head: run.head_sha,
    workflow_path: run.path,
    run_attempt: run.run_attempt,
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
  const accepted = listFinalGateRetryIntents(memoryInput(input, all))
    .filter((intent) => ["ACCEPTED", "UNCERTAIN"].includes(intent.state));
  for (const candidate of accepted) {
    all = comments(input.repository, execute);
    const current = listFinalGateRetryIntents(memoryInput(input, all)).find((intent) => intent.id === candidate.id);
    if (!current || !["ACCEPTED", "UNCERTAIN"].includes(current.state)) continue;
    const recoveryEvidence = fetchRecoveryForTarget(input, current.target, execute, now(), true);
    if (recoveryEvidence === null) continue;
    const result = recoverAcceptedFinalGateIntent({
      ...memoryInput(input, all),
      intent_id: current.id,
      recovery_evidence: recoveryEvidence,
    });
    if (result.decision === "FAIL_CLOSED_MISMATCH") throw new Error("final_gate_live:accepted_recovery_mismatch");
    if (result.persistence) {
      persist(input.repository, result, execute);
      verifyIdentity(input, result.persistence.identity, execute);
    }
  }
  return comments(input.repository, execute);
}

function coderabbitStillClean(reviews, head) {
  reviews = reviews.filter((review) => review.user?.login === "coderabbitai[bot]" && review.commit_id === head);
  if (reviews.some((review) => ["CHANGES_REQUESTED", "APPROVED"].includes(review.state)
    && !Number.isFinite(Date.parse(review.submitted_at)))) throw new Error("final_gate_live:review_time");
  const changes = reviews.filter((r) => r.state === "CHANGES_REQUESTED").map((r) => r.submitted_at ?? "").sort().at(-1) ?? "";
  const approvals = reviews.filter((r) => r.state === "APPROVED").map((r) => r.submitted_at ?? "").sort().at(-1) ?? "";
  return !changes || (approvals && approvals > changes);
}

// Admission and revalidation share this boundary for EVERY event path. A clean
// issue comment is independently valid under CI's contract; it is never assigned
// an unrelated "latest review" ID. Persistent summaries still need the completion
// witness required by CI, but that witness does not become material identity.
function validatedSource(input, source, execute) {
  const head = input.target.head;
  const reviews = pages(`repos/${input.repository}/pulls/${input.pr_number}/reviews`, execute);
  if (source.kind === "pull_request_review") {
    // A verified individual review may become visible before the list endpoint.
    // Reconcile that exact witness; never invent a generation for a comment or
    // prefer a contradictory representation of an already listed review.
    const direct = { id: source.id, user: { login: source.actor }, commit_id: source.review_commit,
      state: source.review_state.toUpperCase(), submitted_at: source.observed_at, body: source.body };
    const listed = reviews.find((r) => r.id === direct.id);
    if (listed && JSON.stringify([listed.user?.login, listed.commit_id, listed.state, listed.submitted_at, listed.body ?? ""])
      !== JSON.stringify([source.actor, direct.commit_id, direct.state, direct.submitted_at, direct.body])) throw new Error("final_gate_live:review_contradiction");
    if (!listed) reviews.push(direct);
  }
  if (!coderabbitStillClean(reviews, head)) throw new Error("final_gate_live:review_changed");
  const all = pages(`repos/${input.repository}/issues/${input.pr_number}/comments`, execute);
  const primaryBody = `<!-- proffera-coderabbit-final-review-request:${head} -->\n@coderabbitai review`;
  const primary = all.filter((c) => c.user?.login === "github-actions[bot]" && c.body === primaryBody)
    .sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const at = (value) => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error("final_gate_live:evidence_time");
    return parsed;
  };
  const primaryTime = primary ? at(primary.created_at) : null;
  const sourceTime = at(source.observed_at);
  if (source.kind === "issue_comment" && at(source.created_at) > sourceTime) throw new Error("final_gate_live:evidence_time");
  const marker = `<!-- proffera-codex-fallback-review-request:${head} -->`;
  const fallback = all.filter((c) => c.user?.login === "ibboabdoli-ai" && c.body?.includes(marker) && c.body.includes("@codex review")
    && primaryTime !== null && at(c.created_at) >= primaryTime)
    .sort((a, b) => at(a.created_at) - at(b.created_at)).at(-1);
  const requirePrimary = (time) => {
    if (primaryTime === null || at(time) < primaryTime) throw new Error("final_gate_live:primary_request_required");
  };
  let findings = [];
  let clearedChanges = [];
  if (source.kind === "issue_comment" && source.actor === "ibboabdoli-ai") {
    requirePrimary(source.created_at);
  } else if (["coderabbitai[bot]", "chatgpt-codex-connector[bot]"].includes(source.actor)) {
    if (source.actor === "chatgpt-codex-connector[bot]") {
      const resultTime = source.kind === "issue_comment" ? at(source.created_at) : sourceTime;
      if (!fallback || resultTime < at(fallback.created_at)) throw new Error("final_gate_live:fallback_request_required");
    }
    const currentInline = pages(`repos/${input.repository}/pulls/${input.pr_number}/comments`, execute)
      .filter((c) => (c.user?.login === "chatgpt-codex-connector[bot]" ? c.commit_id : c.original_commit_id ?? c.commit_id) === head);
    const inline = currentInline.filter((c) => c.user?.login === source.actor);
    // A later APPROVED can change authority after a blocking decision. Preserve
    // that material transition without making a new review ID a retry budget.
    clearedChanges = reviews.filter((r) => r.user?.login === "coderabbitai[bot]" && r.commit_id === head && r.state === "CHANGES_REQUESTED")
      .map((r) => ({ body: r.body ?? "", findings: currentInline.filter((c) => c.user?.login === "coderabbitai[bot]" && c.pull_request_review_id === r.id) }));
    if (source.kind === "pull_request_review") {
      if (source.review_commit !== head || !["commented", "approved"].includes(source.review_state)) throw new Error("final_gate_live:review_source");
      if (source.actor === "chatgpt-codex-connector[bot]" && source.review_state !== "approved") throw new Error("final_gate_live:codex_decision_pending");
      findings = inline.filter((c) => c.pull_request_review_id === source.id);
    } else if (source.actor === "coderabbitai[bot]" && providerUnavailable(source.body)) {
      requirePrimary(source.created_at);
    } else {
      if (source.actor === "chatgpt-codex-connector[bot]") {
        const matches = [...source.body.matchAll(/Reviewed commit:\*{0,2}\s*`?([0-9a-fA-F]{7,40})`?/g)];
        if (!source.body.startsWith("Codex Review: Didn't find any major issues.") || matches.length !== 1
          || !head.startsWith(matches[0][1].toLowerCase())) throw new Error("final_gate_live:clean_head");
      } else if (source.body.includes("<!-- recent_review_start -->")) {
        const clean = source.body.match(/<!-- recent_review_start -->([\s\S]*?)<!-- recent_review_end -->/g);
        if (clean?.length !== 1 || !clean[0].includes(head) || !clean[0].includes("No actionable comments were generated")
          || primaryTime === null || !reviews.some((r) => r.user?.login === source.actor && r.commit_id === head
            && ["COMMENTED", "APPROVED"].includes(r.state) && at(r.submitted_at) >= primaryTime && at(r.submitted_at) <= sourceTime)) {
          throw new Error("final_gate_live:summary_completion_required");
        }
      } else {
        requirePrimary(source.created_at);
        if (!cleanCodeRabbitComment(source.body, head)) {
          throw new Error("final_gate_live:clean_head");
        }
      }
      const lowerBound = source.actor === "coderabbitai[bot]" ? primaryTime : at(fallback.created_at);
      if (inline.some((c) => lowerBound === null || at(c.created_at) >= lowerBound)) throw new Error("final_gate_live:clean_comment_findings");
    }
  }
  const validated = { ...source, findings, cleared_changes: clearedChanges };
  normalizeFinalGateEvidence(validated, head);
  return validated;
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
function failBeforePost(input, decision, reason, execute) {
  // PREPARED was durable, but this serialized writer has revalidated a mismatch and
  // has not attempted the rerun POST. Release only that PREPARED slot so a later
  // stabilized delivery can be admitted without leaving an unrecoverable tombstone.
  const all = comments(input.repository, execute);
  const identity = finalGateMemoryIdentity(memoryInput(input, all)).identity;
  if (JSON.stringify(identity) !== JSON.stringify(decision.persistence.identity)) throw new Error("final_gate_live:release_ownership_lost");
  const result = releaseFinalGatePreparedIntent({
    ...memoryInput(input, all),
    intent_id: decision.intent_id,
  });
  persist(input.repository, result, execute);
  verifyIdentity(input, result.persistence.identity, execute);
  return { decision: "FAIL_CLOSED_MISMATCH", intent_id: decision.intent_id, reason };
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
  const admittedSource = validatedSource(input, initialSource, execute);

  ensureV2(input, execute);
  let all = recoverAcceptedIntents(input, execute, now);
  const decision = decideFinalGateRetry({
    ...memoryInput(input, all),
    target: input.target,
    source: admittedSource,
    prepared_at: now(),
    recovery_evidence: fetchRecovery(input, execute, now()),
  });

  if (decision.persistence) {
    persist(input.repository, decision, execute);
    verifyIdentity(input, decision.persistence.identity, execute);
  }
  if (decision.decision !== "ALLOW_RERUN") return decision;

  // This catch is deliberately confined to reads before the POST boundary. Only
  // this invocation's newly created, durably verified PREPARED record is releasable.
  // Persist/verification ambiguity, crashes and any attempted POST stay pinned.
  try {
    const currentSource = fetchSource(input, execute);
    if (!sameSource(currentSource, input.source)) throw new Error("final_gate_live:source_changed");
    if (fetchPrHead(input, execute) !== input.target.head) throw new Error("final_gate_live:head_changed");
    const currentJob = fetchJob(input, execute);
    if (JSON.stringify(currentJob) !== JSON.stringify(input.target.job)) throw new Error("final_gate_live:job_changed");
    const currentRecovery = fetchRecovery(input, execute, now());
    if (currentRecovery.run_attempt !== input.target.run_attempt) throw new Error("final_gate_live:run_attempt_changed");
    const currentEvidence = normalizeFinalGateEvidence(validatedSource(input, currentSource, execute), input.target.head);
    if (JSON.stringify(currentEvidence) !== JSON.stringify(decision.evidence)) throw new Error("final_gate_live:evidence_changed");
    // Reviews/comments may require several pages. Refresh the mutable run/head
    // authority after those reads as well, before the final durable-intent check.
    if (fetchPrHead(input, execute) !== input.target.head) throw new Error("final_gate_live:head_changed");
    if (fetchRun(input, input.target, execute).run_attempt !== input.target.run_attempt) throw new Error("final_gate_live:run_attempt_changed");
  } catch (error) {
    return failBeforePost(input, decision, error instanceof Error ? error.message : "pre_post_read_failed", execute);
  }
  verifyIdentity(input, decision.persistence.identity, execute);

  // Capture a conservative lower bound immediately before the one allowed POST.
  // GitHub job.started_at is only second-resolution and a rerun can start before the
  // HTTP 201 response reaches this runner. Using a post-response client timestamp
  // would therefore make valid successor evidence look older than acceptance.
  const acceptanceLowerBound = now();
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
      observed_at: acceptanceLowerBound,
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
