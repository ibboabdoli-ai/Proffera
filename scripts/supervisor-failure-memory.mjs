/**
 * A2 historical evidence + D0 retry-intent contract only. This module has no I/O, model calls,
 * workflow imports, live retry decisions or automatic persistence.
 *
 * One canonical bot-owned comment per repository + scope, on Supervisor #548.
 * Known tasks use {kind:"task",task_id}; legacy work uses {kind:"pull_request",
 * pr_number} or {kind:"head",head}. Legacy task_id remains null, never invented.
 *
 * Inputs are public structured descriptors, NOT logs/prompts/provider payloads.
 * The future trusted adapter must verify provenance and sanitize public identifiers;
 * structural checks cannot detect every secret disguised as an identifier.
 * Material error/assertion details may be represented by a caller-supplied digest
 * after safe semantic normalization. Timestamps, run/job IDs, URLs and observed
 * HEAD are not evidence/strategy fingerprint inputs. Explicit stale-head pairs
 * ARE material evidence. No fuzzy text stripping that could collapse real errors.
 *
 * Retention: newest 16 distinct observations globally, ordered by last_seen then
 * observation ID. At most 16 logical records. Counts and first/last_seen describe
 * retained evidence, NOT lifetime history. Duplicate source/head/record delivery
 * updates evidence-time bounds but never adds an observation. Pruned history is
 * not proof of absence. Batch merge is independent of input order.
 *
 * Update protocol for a future writer: read ALL comment pages under the EXISTING
 * Supervisor mutex; readTrustedMemory; compare memoryIdentity with the prepared
 * expected identity; merge; write serializeMemory replacement before releasing
 * the mutex. Identity includes comment ID, revision and full canonical digest.
 * These pure checks are not a remote atomic compare-and-swap or authorization to
 * write. No live issue updates are implemented here.
 *
 * Persisted bodies must be EXACT canonical serialization; this also rejects
 * duplicate JSON keys, extra prose, marker injection and interrupted writes.
 */
import { createHash } from "node:crypto";

export const FAILURE_CATEGORIES = Object.freeze(["workflow_invalid", "browser_failure",
  "unit_contract_failure", "review_blocked", "provider_unavailable", "stale_evidence", "cancelled", "unknown"]);
export const LIMITS = Object.freeze({records: 16, observations: 16, batch: 64, signals: 4,
  identifier: 48, path: 120, body_bytes: 60000, comments: 10000, revision: 1000000,
  unresolved_intents: 4, terminal_intents: 8, recovery_jobs: 32});
const PREFIX = "<!-- proffera-supervisor-failure-memory:";
const OUTCOMES = ["failed", "no_change", "cancelled", "succeeded", "provider_failed", "blocked", "unknown"];
const STRATEGIES = ["rerun_final_gate", "retry_codex_implementation", "batched_review_repair",
  "manual_deterministic_repair", "refresh_base_metadata", "unknown"];
const STOPS = ["same_evidence_strategy_failed", "provider_unavailable", "review_blocked", "none", "unknown"];
const REENTRIES = ["new_failure_fingerprint", "provider_availability_changed",
  "review_evidence_changed", "material_code_change", "human_evidence", "unknown"];
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const fail = (code) => { throw new Error("failure_memory:" + code); };
const isRecord = (value) => value !== null && typeof value === "object"
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function keys(value, names) {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== [...names].sort().join("|")) fail("fields");
}
const canonical = (value) => JSON.stringify(value, (_key, v) =>
  isRecord(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v);
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");
function integer(value, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) fail("integer");
  return value;
}
function member(value, values) {
  if (!values.includes(value)) fail("enum");
  return value;
}
function hex(value, length = 64) {
  if (typeof value !== "string" || !(new RegExp("^[a-f0-9]{" + length + "}$")).test(value)) fail("digest_or_sha");
  return value;
}
function identifier(value) {
  if (typeof value !== "string" || value.length > LIMITS.identifier || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(value)
    || /^(?:gh[pousr]_|github_pat_|sk-|AKIA|eyJ)/.test(value)
    || /[A-Za-z0-9]{32,}/.test(value)) fail("public_identifier_required");
  return value;
}
function taskId(value) {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9-]{1,63}$/.test(value)) fail("task_id");
  return value;
}
function repository(value) {
  if (typeof value !== "string" || value.length > 100
    || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(value)) fail("repository");
  return value.toLowerCase();
}
function path(value) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > LIMITS.path || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value)
    || value.split("/").some((part) => [".", ".."].includes(part))
    || /(?:gh[pousr]_|github_pat_|sk-|AKIA|eyJ)[A-Za-z0-9_-]{12,}/.test(value)) fail("public_path_required");
  return value;
}
function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) fail("timestamp");
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== normalized) fail("timestamp");
  return normalized;
}
function timestampFloorSecond(value) {
  return timestamp(value).replace(/\.\d{3}Z$/, ".000Z");
}
function scope(value) {
  if (!isRecord(value)) fail("scope");
  if (value.kind === "task") {
    keys(value, ["kind", "task_id"]);
    return {kind: "task", task_id: taskId(value.task_id)};
  }
  if (value.kind === "pull_request") {
    keys(value, ["kind", "pr_number"]);
    return {kind: "pull_request", pr_number: integer(value.pr_number)};
  }
  keys(value, ["kind", "head"]);
  return {kind: member(value.kind, ["head"]), head: hex(value.head, 40)};
}
function source(value) {
  if (!isRecord(value)) fail("source");
  if (value.kind === "actions") {
    keys(value, ["kind", "run_id", "attempt", "job_id"]);
    return {kind: "actions", run_id: integer(value.run_id), attempt: integer(value.attempt, 10000),
      job_id: value.job_id === null ? null : integer(value.job_id)};
  }
  if (value.kind === "check") {
    keys(value, ["kind", "check_id"]);
    return {kind: "check", check_id: integer(value.check_id)};
  }
  keys(value, ["kind"]);
  return {kind: member(value.kind, ["unknown"])};
}
export function normalizeEvidence(value) {
  keys(value, ["lane", "category", "signals", "provider_class", "stale_heads"]);
  if (!Array.isArray(value.signals) || value.signals.length > LIMITS.signals || (value.category !== "unknown" && !value.signals.length)) fail("signals_bound");
  const signals = value.signals.map((signal) => {
    keys(signal, ["code", "path", "test_id", "detail_digest"]);
    return {code: identifier(signal.code), path: path(signal.path),
      test_id: signal.test_id === null ? null : identifier(signal.test_id),
      detail_digest: hex(signal.detail_digest)};
  });
  let stale = null;
  if (value.stale_heads !== null) {
    keys(value.stale_heads, ["observed_head", "current_head"]);
    stale = {observed_head: hex(value.stale_heads.observed_head, 40), current_head: hex(value.stale_heads.current_head, 40)};
  }
  return {lane: identifier(value.lane), category: member(value.category, FAILURE_CATEGORIES),
    signals: [...new Map(signals.map((signal) => [canonical(signal), signal])).values()].sort((a, b) => cmp(canonical(a), canonical(b))),
    provider_class: value.provider_class === null ? null : member(value.provider_class,
      ["rate_limited", "unavailable", "internal_error", "authentication_failed", "quota_exhausted", "unknown"]),
    stale_heads: stale};
}
function strategy(value) {
  keys(value, ["kind", "hypothesis_id", "variant_id"]);
  return {kind: member(value.kind, STRATEGIES), hypothesis_id: identifier(value.hypothesis_id),
    variant_id: identifier(value.variant_id)};
}
function condition(value, kinds) {
  keys(value, ["kind", "reference_digest"]);
  return {kind: member(value.kind, kinds), reference_digest: value.reference_digest === null ? null : hex(value.reference_digest)};
}
export const fingerprintEvidence = (value) => hash({version: 1, evidence: normalizeEvidence(value)});
export const fingerprintStrategy = (value) => hash({version: 1, strategy: strategy(value)});

const BASE_FIELDS = ["repository", "task_id", "pr_number", "evidence", "strategy", "action_id",
  "outcome", "outcome_basis", "stop", "reentry"];
function base(value, repo, memoryScope) {
  const normalized = {repository: repository(value.repository),
    task_id: value.task_id === null ? null : taskId(value.task_id),
    pr_number: value.pr_number === null ? null : integer(value.pr_number),
    evidence: normalizeEvidence(value.evidence), strategy: strategy(value.strategy),
    action_id: identifier(value.action_id), outcome: member(value.outcome, OUTCOMES),
    outcome_basis: member(value.outcome_basis, ["strategy_result", "provider_result", "gate_result", "unknown"]),
    stop: condition(value.stop, STOPS), reentry: condition(value.reentry, REENTRIES)};
  if (normalized.repository !== repo) fail("repository_mismatch");
  if (memoryScope.kind === "task" ? normalized.task_id !== memoryScope.task_id : normalized.task_id !== null) fail("task_mismatch");
  if (memoryScope.kind === "pull_request" && normalized.pr_number !== memoryScope.pr_number) fail("pr_mismatch");
  if (memoryScope.kind === "head" && normalized.pr_number !== null) fail("head_scope_requires_unknown_pr");
  if (normalized.outcome === "succeeded" && normalized.outcome_basis !== "strategy_result") fail("strategy_success_requires_evidence");
  return normalized;
}
const recordId = (value) => hash({version: 1, record: value});
const observationId = (id, head, origin) => hash({version: 1, record_id: id, head, source: origin});
function observation(value, repo, memoryScope) {
  keys(value, [...BASE_FIELDS, "head", "observed_at", "source"]);
  const context = base(value, repo, memoryScope);
  const head = hex(value.head, 40), at = timestamp(value.observed_at), origin = source(value.source);
  if (memoryScope.kind === "head" && memoryScope.head !== head) fail("head_scope_mismatch");
  const id = recordId(context);
  return {context, record_id: id, observation: {id: observationId(id, head, origin), head,
    source: origin, first_seen: at, last_seen: at}};
}
const newest = (a, b) => cmp(b.last_seen, a.last_seen) || cmp(a.id, b.id);
function makeRecord(context, observations) {
  const sorted = [...observations].sort(newest);
  return {...context, id: recordId(context), evidence_fingerprint: fingerprintEvidence(context.evidence),
    strategy_fingerprint: fingerprintStrategy(context.strategy), observed_head: sorted[0].head,
    first_seen: [...sorted].sort((a, b) => cmp(a.first_seen, b.first_seen))[0].first_seen,
    last_seen: sorted[0].last_seen, observation_count: sorted.length, observations: sorted};
}
function validateRecord(value, repo, memoryScope) {
  keys(value, [...BASE_FIELDS, "id", "evidence_fingerprint", "strategy_fingerprint", "observed_head",
    "first_seen", "last_seen", "observation_count", "observations"]);
  const context = base(value, repo, memoryScope), id = recordId(context);
  if (hex(value.id) !== id || hex(value.evidence_fingerprint) !== fingerprintEvidence(context.evidence)
    || hex(value.strategy_fingerprint) !== fingerprintStrategy(context.strategy)) fail("fingerprint_mismatch");
  if (!Array.isArray(value.observations) || value.observations.length === 0
    || value.observations.length > LIMITS.observations) fail("observations_bound");
  const seen = new Set();
  const observations = value.observations.map((item) => {
    keys(item, ["id", "head", "source", "first_seen", "last_seen"]);
    const head = hex(item.head, 40), origin = source(item.source);
    const expected = observationId(id, head, origin);
    if (hex(item.id) !== expected || seen.has(expected)) fail("observation_collision");
    seen.add(expected);
    if (memoryScope.kind === "head" && memoryScope.head !== head) fail("head_scope_mismatch");
    const first = timestamp(item.first_seen), last = timestamp(item.last_seen);
    if (first > last) fail("time_order");
    return {id: expected, head, source: origin, first_seen: first, last_seen: last};
  });
  const result = makeRecord(context, observations);
  if (value.observation_count !== result.observation_count || value.observed_head !== result.observed_head
    || timestamp(value.first_seen) !== result.first_seen || timestamp(value.last_seen) !== result.last_seen) fail("observation_metadata");
  return result;
}
function validateMemory(value) {
  if (!isRecord(value) || ![1, 2].includes(value.schema_version)) fail("unsupported_version");
  keys(value, ["schema_version", "repository", "scope", "revision", "records",
    ...(value.schema_version === 2 ? ["intents", "intent_admission_closed"] : [])]);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > LIMITS.revision) fail("revision");
  const repo = repository(value.repository), memoryScope = scope(value.scope);
  if (!Array.isArray(value.records) || value.records.length > LIMITS.records) fail("records_bound");
  const records = value.records.map((r) => validateRecord(r, repo, memoryScope)).sort((a, b) => cmp(a.id, b.id));
  if (new Set(records.map((r) => r.id)).size !== records.length) fail("record_collision");
  if (records.reduce((sum, r) => sum + r.observation_count, 0) > LIMITS.observations) fail("observations_bound");
  if (value.revision === 0 && records.length > 0) fail("revision");
  const result = {schema_version: value.schema_version, repository: repo, scope: memoryScope, revision: value.revision, records};
  return value.schema_version === 1 ? result : {...result, ...validateIntents(value, repo, memoryScope)};
}
export function createMemory(repo, memoryScope) {
  return {schema_version: 1, repository: repository(repo), scope: scope(memoryScope), revision: 0, records: []};
}
export function memoryMarker(repo, memoryScope, version = 1) {
  member(version, [1, 2]);
  return PREFIX + "v" + version + ":" + hash({repository: repository(repo), scope: scope(memoryScope)}) + " -->";
}
export function serializeMemory(value) {
  const memory = validateMemory(value);
  const body = memoryMarker(memory.repository, memory.scope, memory.schema_version) + "\n\x60\x60\x60json\n" + canonical(memory) + "\n\x60\x60\x60";
  if (Buffer.byteLength(body, "utf8") > LIMITS.body_bytes) fail("body_bound");
  return body;
}
function snapshot(value) {
  keys(value, ["comment_id", "memory"]);
  return {comment_id: value.comment_id === null ? null : integer(value.comment_id), memory: validateMemory(value.memory)};
}
export function memoryIdentity(value) {
  const current = snapshot(value);
  return {comment_id: current.comment_id, revision: current.memory.revision, digest: hash(serializeMemory(current.memory))};
}

/** comments must be a complete authenticated API read, not user-provided actor assertions. */
export function readTrustedMemory(comments, {repository: repo, scope: memoryScope, complete}) {
  const empty = createMemory(repo, memoryScope);
  if (complete !== true || !Array.isArray(comments) || comments.length > LIMITS.comments) fail("incomplete_comments");
  const targetScope = canonical(empty.scope);
  const matches = [];
  for (const comment of comments) {
    if (comment?.user?.login !== "github-actions[bot]" || comment?.user?.type !== "Bot") continue;
    if (typeof comment.body !== "string" || !comment.body.includes(PREFIX)) continue;
    if (typeof comment.issue_url !== "string" || comment.issue_url.toLowerCase() !==
      "https://api.github.com/repos/" + empty.repository + "/issues/548") fail("comment_provenance");
    if (Buffer.byteLength(comment.body, "utf8") > LIMITS.body_bytes) fail("body_bound");
    if (comment.body.split(PREFIX).length !== 2) fail("duplicate_marker");
    // Parse every bot memory candidate before scope filtering: malformed or unknown
    // scope/version must not be silently treated as absence and overwritten.
    const match = comment.body.match(/^<!-- proffera-supervisor-failure-memory:v([12]):([a-f0-9]{64}) -->\n\x60\x60\x60json\n([^\n]+)\n\x60\x60\x60$/);
    if (!match) fail("malformed_body_or_version");
    let decoded;
    try { decoded = JSON.parse(match[3]); } catch { fail("malformed_json"); }
    const memory = validateMemory(decoded);
    if (serializeMemory(memory) !== comment.body) fail("noncanonical_body");
    if (memory.repository !== empty.repository) fail("repository_mismatch");
    const commentId = integer(comment.id);
    if (canonical(memory.scope) === targetScope) matches.push({comment_id: commentId, memory});
  }
  if (matches.length > 1) fail("ambiguous_comments");
  return matches[0] ?? {comment_id: null, memory: empty};
}

/** Pure replacement preparation. The caller must re-read under the existing mutex before writing. */
export function mergeObservations(currentValue, expected, values) {
  const current = checkedCurrent(currentValue, expected, false);
  if (!Array.isArray(values) || values.length > LIMITS.batch) fail("batch_bound");
  const contexts = new Map(), observations = new Map();
  const add = (context, item) => {
    const id = recordId(context);
    if (contexts.has(id) && canonical(contexts.get(id)) !== canonical(context)) fail("record_collision");
    contexts.set(id, context);
    const previous = observations.get(item.id);
    if (previous) {
      if (previous.record_id !== id || previous.head !== item.head || canonical(previous.source) !== canonical(item.source)) fail("observation_collision");
      previous.first_seen = previous.first_seen < item.first_seen ? previous.first_seen : item.first_seen;
      previous.last_seen = previous.last_seen > item.last_seen ? previous.last_seen : item.last_seen;
    } else observations.set(item.id, {...item, record_id: id});
  };
  for (const record of current.memory.records) {
    const context = base(record, current.memory.repository, current.memory.scope);
    for (const item of record.observations) add(context, item);
  }
  for (const value of values) {
    const normalized = observation(value, current.memory.repository, current.memory.scope);
    add(normalized.context, normalized.observation);
  }
  const retained = [...observations.values()].sort(newest).slice(0, LIMITS.observations);
  const groups = new Map();
  for (const item of retained) {
    const {record_id, ...entry} = item;
    if (!groups.has(record_id)) groups.set(record_id, []);
    groups.get(record_id).push(entry);
  }
  const records = [...groups].map(([id, entries]) => makeRecord(contexts.get(id), entries)).sort((a, b) => cmp(a.id, b.id));
  return replacement(current, {...current.memory, records});
}
export const mergeObservation = (current, expected, value) => mergeObservations(current, expected, [value]);

/**
 * D0 is preparation/recovery only: returning a replacement NEVER authorizes a POST.
 * Future D1a must authenticate all descriptors/receipts against GitHub, and use one
 * NON-CANCELLING repository/PR serialization group for every writer of this document.
 * Verify persisted PREPARED identity under that same lock, then revalidate the exact
 * source/head/evidence/job before the one POST. Failed/ambiguous POST, cancellation,
 * missing history or failed receipt persistence NEVER permit automatic reuse.
 *
 * Recovery requires a retained target-bound HTTP 201 receipt AND a compatible new
 * execution of the exact final job in the immediately following run attempt, with
 * complete baseline/successor evidence. It does not prove who initiated that job;
 * GitHub has no material-evidence idempotency key. Without a receipt even a matching
 * manual rerun stays UNCERTAIN. Never infer acceptance from workflow success.
 *
 * All PREPARED/ACCEPTED/UNCERTAIN intents are pinned (max 4); only CONSUMED is terminal
 * (max 8). On terminal eviction admission closes irreversibly for this document.
 * This deliberate liveness limit prevents a forgotten ID being admitted again
 * without an unbounded tombstone store. Existing recovery and A2 history still work.
 * There is no automatic reset, expiration, downgrade, retry or manual-recovery API.
 *
 * v1 bodies remain byte-compatible. upgradeMemory explicitly changes the SAME
 * comment to v2 under its old identity; never create a second authoritative comment.
 * Initializing/deleting/replacing a document is NOT recovery from missing history.
 */
export const RETRY_INTEGRATION = Object.freeze({
  scope: "repository_pull_request",
  cancel_in_progress: false,
  order: Object.freeze(["validate_trusted_source", "validate_exact_target", "normalize_evidence",
    "read_trusted_memory", "check_existing_intent", "persist_prepared", "verify_persisted_identity",
    "revalidate_source_head_evidence_job", "post_once", "persist_confirmed_acceptance", "recover_from_github"]),
});
const INTENT_STATES = ["PREPARED", "ACCEPTED", "CONSUMED", "UNCERTAIN"];
const UNCERTAINTY = ["post_failed", "acceptance_unknown", "persistence_failed", "runner_interrupted", "insufficient_evidence"];
const FINAL_JOB = "E2E public smoke";
const CI_PATH = ".github/workflows/ci.yml";

function checkedCurrent(value, expected, requireV2 = true) {
  const current = snapshot(value);
  keys(expected, ["comment_id", "revision", "digest"]);
  if (canonical(expected) !== canonical(memoryIdentity(current))) fail("stale_memory");
  if (requireV2 && current.memory.schema_version !== 2) fail("explicit_v2_upgrade_required");
  return current;
}
function replacement(current, memory) {
  if (canonical(memory) === canonical(current.memory)) return current;
  if (current.memory.revision === LIMITS.revision) fail("revision_exhausted");
  const next = {...memory, revision: current.memory.revision + 1};
  serializeMemory(next);
  return {comment_id: current.comment_id, memory: validateMemory(next)};
}
export function upgradeMemory(value, expected) {
  const current = checkedCurrent(value, expected, false);
  if (current.memory.schema_version === 2) return current;
  return replacement(current, {...current.memory, schema_version: 2, intents: [], intent_admission_closed: false});
}
function finalJob(value) {
  keys(value, ["id", "run_id", "head", "run_attempt", "name", "status", "conclusion", "started_at", "completed_at"]);
  const job = {id: integer(value.id), run_id: integer(value.run_id), head: hex(value.head, 40),
    run_attempt: integer(value.run_attempt, 10000), name: member(value.name, [FINAL_JOB]),
    status: member(value.status, ["queued", "in_progress", "completed"]),
    conclusion: value.conclusion === null ? null : member(value.conclusion, ["success", "failure", "cancelled", "timed_out", "skipped", "neutral"]),
    started_at: value.started_at === null ? null : timestamp(value.started_at),
    completed_at: value.completed_at === null ? null : timestamp(value.completed_at)};
  if (job.status === "completed" ? !job.conclusion || !job.completed_at
    : job.conclusion !== null || job.completed_at !== null) fail("job_state");
  if (job.status === "in_progress" && !job.started_at) fail("job_state");
  if (job.started_at && job.completed_at && job.started_at > job.completed_at) fail("job_time");
  return job;
}
function retryTarget(value) {
  keys(value, ["workflow_path", "run_id", "head", "run_attempt", "job"]);
  const target = {workflow_path: member(value.workflow_path, [CI_PATH]), run_id: integer(value.run_id),
    head: hex(value.head, 40), run_attempt: integer(value.run_attempt, 9999), job: finalJob(value.job)};
  if (target.job.run_id !== target.run_id || target.job.head !== target.head
    || target.job.run_attempt !== target.run_attempt || target.job.status !== "completed"
    || !["failure", "cancelled"].includes(target.job.conclusion) || !target.job.started_at) fail("target_mismatch");
  return target;
}
function retrySource(value, repo, head) {
  keys(value, ["kind", "id", "actor", "observed_at", "review_commit", "body_digest"]);
  const origin = {kind: member(value.kind, ["issue_comment", "pull_request_review"]), id: integer(value.id),
    actor: member(value.actor, ["coderabbitai[bot]", "chatgpt-codex-connector[bot]", repo.split("/")[0]]),
    observed_at: timestamp(value.observed_at),
    review_commit: value.review_commit === null ? null : hex(value.review_commit, 40),
    body_digest: hex(value.body_digest)};
  if (origin.kind === "pull_request_review" ? origin.review_commit !== head || origin.actor === repo.split("/")[0]
    : origin.review_commit !== null) fail("source_mismatch");
  return origin;
}
function intentBase(value, repo, memoryScope) {
  if (memoryScope.kind !== "pull_request") fail("intent_requires_pr_scope");
  const context = {repository: repository(value.repository), pr_number: integer(value.pr_number),
    evidence: normalizeEvidence(value.evidence), strategy: strategy(value.strategy)};
  if (context.repository !== repo || context.pr_number !== memoryScope.pr_number) fail("intent_scope_mismatch");
  if (context.strategy.kind !== "rerun_final_gate") fail("intent_strategy");
  if (!context.evidence.signals.length || context.evidence.category === "unknown") fail("intent_evidence_unknown");
  return context;
}
function materialIntentId(context) {
  return hash({version: 2, repository: context.repository, scope: {kind: "pull_request", pr_number: context.pr_number},
    evidence_fingerprint: fingerprintEvidence(context.evidence), strategy_fingerprint: fingerprintStrategy(context.strategy)});
}
function intentBinding(id, target, origin, preparedAt) {
  return hash({version: 2, intent_id: id, target, source: origin, prepared_at: preparedAt});
}
function acceptance(value, binding, preparedAt) {
  keys(value, ["http_status", "binding_digest", "observed_at"]);
  const receipt = {http_status: member(value.http_status, [201]), binding_digest: hex(value.binding_digest),
    observed_at: timestamp(value.observed_at)};
  if (receipt.binding_digest !== binding || receipt.observed_at < preparedAt) fail("acceptance_mismatch");
  return receipt;
}
function recoveryEvidence(value) {
  keys(value, ["repository", "pr_number", "run_id", "head", "workflow_path", "run_attempt", "complete", "observed_at", "jobs"]);
  if (typeof value.complete !== "boolean" || !Array.isArray(value.jobs) || value.jobs.length > LIMITS.recovery_jobs) fail("recovery_bound");
  const jobs = value.jobs.map(finalJob).sort((a, b) => a.run_attempt - b.run_attempt || a.id - b.id);
  if (new Set(jobs.map((j) => j.id)).size !== jobs.length) fail("recovery_job_collision");
  return {repository: repository(value.repository), pr_number: integer(value.pr_number), run_id: integer(value.run_id),
    head: hex(value.head, 40), workflow_path: member(value.workflow_path, [CI_PATH]),
    run_attempt: integer(value.run_attempt, 10000), complete: value.complete,
    observed_at: timestamp(value.observed_at), jobs};
}
function recovery(intent, input) {
  const evidence = recoveryEvidence(input), target = intent.target;
  const reject = {decision: "REJECT_MISMATCH", proof: null};
  const uncertain = {decision: "KEEP_UNCERTAIN", proof: null};
  if (evidence.repository !== intent.repository || evidence.pr_number !== intent.pr_number
    || evidence.run_id !== target.run_id || evidence.head !== target.head || evidence.workflow_path !== target.workflow_path
    || evidence.run_attempt < target.run_attempt || evidence.observed_at < intent.updated_at
    || evidence.jobs.some((j) => j.run_id !== target.run_id || j.head !== target.head || j.run_attempt > evidence.run_attempt)) return reject;
  const baseline = evidence.jobs.find((j) => j.id === target.job.id);
  if (baseline && canonical(baseline) !== canonical(target.job)) return reject;
  if (!evidence.complete || !baseline || !intent.acceptance || evidence.run_attempt !== target.run_attempt + 1) return uncertain;
  const later = evidence.jobs.filter((j) => j.run_attempt === target.run_attempt + 1);
  if (later.length !== 1) return uncertain;
  const job = later[0];
  if (job.id === target.job.id || !job.started_at || job.started_at < timestampFloorSecond(intent.acceptance.observed_at)
    || job.started_at <= target.job.completed_at || job.started_at > evidence.observed_at
    || (job.completed_at && job.completed_at > evidence.observed_at)
    || !["in_progress", "completed"].includes(job.status) || ["skipped", "neutral"].includes(job.conclusion)) return uncertain;
  // Store only the bounded witness pair; input pagination completeness is adapter-attested.
  return {decision: "CONFIRM_CONSUMED", proof: {...evidence, jobs: [baseline, job]}};
}
function validateIntent(value, repo, memoryScope) {
  keys(value, ["repository", "pr_number", "evidence", "strategy", "id", "evidence_fingerprint", "strategy_fingerprint",
    "target", "source", "binding_digest", "prepared_at", "updated_at", "state", "acceptance", "proof", "uncertain_reason"]);
  const context = intentBase(value, repo, memoryScope), id = materialIntentId(context);
  const target = retryTarget(value.target), origin = retrySource(value.source, repo, target.head);
  const prepared = timestamp(value.prepared_at), updated = timestamp(value.updated_at);
  const binding = intentBinding(id, target, origin, prepared);
  if (hex(value.id) !== id || hex(value.binding_digest) !== binding
    || hex(value.evidence_fingerprint) !== fingerprintEvidence(context.evidence)
    || hex(value.strategy_fingerprint) !== fingerprintStrategy(context.strategy)) fail("intent_fingerprint_mismatch");
  if (prepared < origin.observed_at || prepared < target.job.completed_at || updated < prepared) fail("intent_time");
  const receipt = value.acceptance === null ? null : acceptance(value.acceptance, binding, prepared);
  if (receipt && receipt.observed_at > updated) fail("intent_time");
  const result = {...context, id, evidence_fingerprint: fingerprintEvidence(context.evidence),
    strategy_fingerprint: fingerprintStrategy(context.strategy), target, source: origin, binding_digest: binding,
    prepared_at: prepared, updated_at: updated, state: member(value.state, INTENT_STATES), acceptance: receipt,
    proof: null, uncertain_reason: value.uncertain_reason === null ? null : member(value.uncertain_reason, UNCERTAINTY)};
  if (result.state === "PREPARED" && (receipt || value.proof || result.uncertain_reason || updated !== prepared)) fail("intent_state");
  if (result.state === "ACCEPTED" && (!receipt || value.proof || result.uncertain_reason || updated !== receipt.observed_at)) fail("intent_state");
  if (result.state === "UNCERTAIN" && (value.proof || !result.uncertain_reason)) fail("intent_state");
  if (result.state !== "CONSUMED" && value.proof !== null) fail("intent_state");
  if (result.state === "CONSUMED") {
    if (!receipt || result.uncertain_reason || !value.proof) fail("intent_state");
    const recovered = recovery(result, value.proof);
    if (recovered.decision !== "CONFIRM_CONSUMED" || recovered.proof.observed_at !== updated) fail("consumption_proof");
    result.proof = recovered.proof;
  }
  return result;
}
function validateIntents(value, repo, memoryScope) {
  if (!Array.isArray(value.intents) || value.intents.length > LIMITS.unresolved_intents + LIMITS.terminal_intents
    || typeof value.intent_admission_closed !== "boolean") fail("intents_bound");
  const intents = value.intents.map((i) => validateIntent(i, repo, memoryScope)).sort((a, b) => cmp(a.id, b.id));
  if (new Set(intents.map((i) => i.id)).size !== intents.length) fail("intent_collision");
  if (intents.filter((i) => i.state !== "CONSUMED").length > LIMITS.unresolved_intents
    || intents.filter((i) => i.state === "CONSUMED").length > LIMITS.terminal_intents) fail("intents_bound");
  if (value.revision === 0 && (intents.length || value.intent_admission_closed)) fail("revision");
  return {intents, intent_admission_closed: value.intent_admission_closed};
}

/** A newly prepared replacement is not durable until the future writer persists and re-reads it. */
export function prepareRetryIntent(value, expected, input) {
  const current = checkedCurrent(value, expected);
  keys(input, ["repository", "pr_number", "evidence", "strategy", "target", "source", "prepared_at"]);
  const context = intentBase(input, current.memory.repository, current.memory.scope), id = materialIntentId(context);
  const target = retryTarget(input.target), origin = retrySource(input.source, context.repository, target.head);
  const prepared = timestamp(input.prepared_at);
  const intent = validateIntent({...context, id, evidence_fingerprint: fingerprintEvidence(context.evidence),
    strategy_fingerprint: fingerprintStrategy(context.strategy), target, source: origin,
    binding_digest: intentBinding(id, target, origin, prepared), prepared_at: prepared, updated_at: prepared,
    state: "PREPARED", acceptance: null, proof: null, uncertain_reason: null}, context.repository, current.memory.scope);
  // Head, target, time and event churn never replace the first binding or authorize reuse.
  if (current.memory.intents.some((i) => i.id === id)) return {snapshot: current, intent_id: id, created: false};
  if (current.memory.intent_admission_closed) fail("intent_admission_closed");
  if (current.memory.intents.filter((i) => i.state !== "CONSUMED").length >= LIMITS.unresolved_intents) fail("unresolved_capacity");
  return {snapshot: replacement(current, {...current.memory, intents: [...current.memory.intents, intent]}), intent_id: id, created: true};
}
export function decideRetryRecovery(intent, evidence) {
  try {
    const normalized = validateIntent(intent, repository(intent.repository), {kind: "pull_request", pr_number: integer(intent.pr_number)});
    return recovery(normalized, evidence);
  } catch {
    return {decision: "REJECT_MISMATCH", proof: null};
  }
}
/** No transition returns PREPARED. Receipt-less uncertainty cannot be inferred away. */
export function transitionRetryIntent(value, expected, id, event) {
  const current = checkedCurrent(value, expected);
  hex(id);
  const previous = current.memory.intents.find((i) => i.id === id);
  if (!previous) fail("intent_missing");
  if (!isRecord(event)) fail("transition");
  let next;
  if (event.kind === "accepted") {
    keys(event, ["kind", "receipt"]);
    const receipt = acceptance(event.receipt, previous.binding_digest, previous.prepared_at);
    if (previous.state === "ACCEPTED" && canonical(receipt) === canonical(previous.acceptance)) return current;
    if (!["PREPARED", "UNCERTAIN"].includes(previous.state) || previous.acceptance
      || receipt.observed_at < previous.updated_at) fail("illegal_transition");
    next = {...previous, state: "ACCEPTED", acceptance: receipt, uncertain_reason: null, updated_at: receipt.observed_at};
  } else if (event.kind === "uncertain") {
    keys(event, ["kind", "reason", "observed_at"]);
    if (previous.state === "CONSUMED") fail("illegal_transition");
    const at = timestamp(event.observed_at);
    if (at < previous.updated_at) fail("transition_time");
    next = {...previous, state: "UNCERTAIN", uncertain_reason: member(event.reason, UNCERTAINTY), updated_at: at};
  } else if (event.kind === "recover") {
    keys(event, ["kind", "evidence"]);
    const result = decideRetryRecovery(previous, event.evidence);
    if (result.decision === "REJECT_MISMATCH") fail("recovery_mismatch");
    if (previous.state === "CONSUMED") {
      if (result.decision === "CONFIRM_CONSUMED") return current;
      fail("illegal_transition");
    }
    next = result.decision === "CONFIRM_CONSUMED"
      ? {...previous, state: "CONSUMED", proof: result.proof, uncertain_reason: null, updated_at: result.proof.observed_at}
      : {...previous, state: "UNCERTAIN", uncertain_reason: "insufficient_evidence", updated_at: timestamp(event.evidence.observed_at)};
  } else fail("illegal_transition");
  const intents = current.memory.intents.map((i) => i.id === id ? next : i);
  const terminal = intents.filter((i) => i.state === "CONSUMED").sort((a, b) => cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id));
  const evicted = new Set(terminal.slice(LIMITS.terminal_intents).map((i) => i.id));
  return replacement(current, {...current.memory, intents: intents.filter((i) => !evicted.has(i.id)),
    intent_admission_closed: current.memory.intent_admission_closed || evicted.size > 0});
}
