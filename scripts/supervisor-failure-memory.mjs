/**
 * A2 supplemental historical evidence only. This module has no I/O, model calls,
 * workflow imports, retry decisions or automatic persistence.
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
  identifier: 48, path: 120, body_bytes: 60000, comments: 10000, revision: 1000000});
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
  keys(value, ["schema_version", "repository", "scope", "revision", "records"]);
  if (value.schema_version !== 1) fail("unsupported_version");
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > LIMITS.revision) fail("revision");
  const repo = repository(value.repository), memoryScope = scope(value.scope);
  if (!Array.isArray(value.records) || value.records.length > LIMITS.records) fail("records_bound");
  const records = value.records.map((r) => validateRecord(r, repo, memoryScope)).sort((a, b) => cmp(a.id, b.id));
  if (new Set(records.map((r) => r.id)).size !== records.length) fail("record_collision");
  if (records.reduce((sum, r) => sum + r.observation_count, 0) > LIMITS.observations) fail("observations_bound");
  if (value.revision === 0 && records.length > 0) fail("revision");
  return {schema_version: 1, repository: repo, scope: memoryScope, revision: value.revision, records};
}
export function createMemory(repo, memoryScope) {
  return {schema_version: 1, repository: repository(repo), scope: scope(memoryScope), revision: 0, records: []};
}
export function memoryMarker(repo, memoryScope) {
  return PREFIX + "v1:" + hash({repository: repository(repo), scope: scope(memoryScope)}) + " -->";
}
export function serializeMemory(value) {
  const memory = validateMemory(value);
  const body = memoryMarker(memory.repository, memory.scope) + "\n\x60\x60\x60json\n" + canonical(memory) + "\n\x60\x60\x60";
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
  const target = memoryMarker(empty.repository, empty.scope);
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
    const match = comment.body.match(/^<!-- proffera-supervisor-failure-memory:v1:([a-f0-9]{64}) -->\n\x60\x60\x60json\n([^\n]+)\n\x60\x60\x60$/);
    if (!match) fail("malformed_body_or_version");
    let decoded;
    try { decoded = JSON.parse(match[2]); } catch { fail("malformed_json"); }
    const memory = validateMemory(decoded);
    if (serializeMemory(memory) !== comment.body) fail("noncanonical_body");
    if (memory.repository !== empty.repository) fail("repository_mismatch");
    if (comment.body.startsWith(target + "\n")) matches.push({comment_id: integer(comment.id), memory});
  }
  if (matches.length > 1) fail("ambiguous_comments");
  return matches[0] ?? {comment_id: null, memory: empty};
}

/** Pure replacement preparation. The caller must re-read under the existing mutex before writing. */
export function mergeObservations(currentValue, expected, values) {
  const current = snapshot(currentValue);
  keys(expected, ["comment_id", "revision", "digest"]);
  if (canonical(expected) !== canonical(memoryIdentity(current))) fail("stale_memory");
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
  if (canonical(records) === canonical(current.memory.records)) return current;
  if (current.memory.revision === LIMITS.revision) fail("revision_exhausted");
  const memory = {...current.memory, revision: current.memory.revision + 1, records};
  serializeMemory(memory); // Prove bounded, valid replacement before returning it.
  return {comment_id: current.comment_id, memory};
}
export const mergeObservation = (current, expected, value) => mergeObservations(current, expected, [value]);
