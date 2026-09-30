import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone pure Node .mjs follows the existing control-plane test convention.
import { createMemory, memoryIdentity, memoryMarker, mergeObservation, mergeObservations, serializeMemory, readTrustedMemory, fingerprintEvidence, fingerprintStrategy, normalizeEvidence, FAILURE_CATEGORIES, LIMITS } from "../scripts/supervisor-failure-memory.mjs";

const repo = "ibboabdoli-ai/Proffera";
const head = "e280c5a21505b082fec2c519a3f2e675de97770c";
const scope = {kind: "pull_request", pr_number: 878};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const at = (n: number) => new Date(Date.UTC(2026, 8, 29, 0, 0, n)).toISOString();
const signal = (text = "provider_internal_error") => ({code: "provider_internal_error", path: null,
  test_id: null, detail_digest: digest(text)});
const evidence = () => ({lane: "codex_implementation", category: "provider_unavailable",
  signals: [signal()], provider_class: "internal_error", stale_heads: null});
const strategy = () => ({kind: "retry_codex_implementation", hypothesis_id: "transient_provider_failure", variant_id: "directory_location_v1"});
// Synthetic descriptors/times/source IDs model the supplied #878 repeat pattern, not raw history.
const observation = (attempt = 1, overrides = {}) => ({
  repository: repo, task_id: null, pr_number: 878, head, evidence: evidence(), strategy: strategy(),
  action_id: "run_codex_implementation", outcome: "provider_failed", outcome_basis: "provider_result",
  stop: {kind: "same_evidence_strategy_failed", reference_digest: null},
  reentry: {kind: "provider_availability_changed", reference_digest: null},
  source: {kind: "actions", run_id: 1001, attempt, job_id: null}, observed_at: at(attempt), ...overrides,
});
const empty = (s = scope) => ({comment_id: null, memory: createMemory(repo, s)});
const add = (current: ReturnType<typeof empty>, value: unknown = observation()) => mergeObservation(current, memoryIdentity(current), value);
const bot = (body: string, id = 123) => ({id, body, user: {login: "github-actions[bot]", type: "Bot"},
  issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548"});
const read = (comments: unknown[], options = {}) => readTrustedMemory(comments, {repository: repo, scope, complete: true, ...options});
const fill = (n: number, distinct = false) => Array.from({length: n}, (_, i) => observation(i + 1,
  distinct ? {action_id: "action_" + i} : {}));

describe("Failure Memory v1 identity and evidence", () => {
  it("creates and round-trips valid empty memory", () => {
    const current = empty();
    expect(current.memory.records).toEqual([]);
    expect(read([])).toEqual(current);
    expect(read([bot(serializeMemory(current.memory))])).toEqual({...current, comment_id: 123});
  });

  it("inserts first bounded record and round-trips canonical trusted state", () => {
    const next = add(empty());
    expect(next.memory.revision).toBe(1);
    expect(next.memory.records).toHaveLength(1);
    expect(next.memory.records[0]).toMatchObject({repository: repo.toLowerCase(), task_id: null,
      pr_number: 878, observed_head: head, outcome: "provider_failed", first_seen: at(1),
      last_seen: at(1), observation_count: 1});
    expect(read([bot(serializeMemory(next.memory))]).memory).toEqual(next.memory);
  });

  it("makes duplicate event delivery a revision/count no-op", () => {
    const once = add(empty());
    expect(add(once)).toEqual(once);
    expect(add(once).memory.records[0].observation_count).toBe(1);
  });

  it("updates re-observed evidence time without adding an observation", () => {
    const first = add(empty());
    const next = add(first, observation(1, {observed_at: at(8)}));
    expect(next.memory.records[0]).toMatchObject({observation_count: 1, first_seen: at(1), last_seen: at(8)});
    expect(add(next, observation(1, {observed_at: at(2)}))).toEqual(next);
  });

  it("represents the two #878 provider attempts as one logical failure", () => {
    const next = mergeObservations(empty(), memoryIdentity(empty()), [observation(1), observation(2)]);
    expect(next.memory.records).toHaveLength(1);
    expect(next.memory.records[0]).toMatchObject({pr_number: 878, observation_count: 2, outcome: "provider_failed"});
  });

  it("represents seven final-gate attempts as one failure/strategy record", () => {
    // GitHub reports this run/head and seven attempts, but no PR association.
    const current = {comment_id: null, memory: createMemory(repo, {kind: "head", head})};
    const values = fill(7).map((value) => ({...value, pr_number: null,
      source: {...value.source, run_id: 36622937789},
      evidence: {...evidence(), lane: "ci_final_gate", category: "review_blocked",
        provider_class: null, signals: [{...signal("exact-review-findings"), code: "review_changes_requested"}]},
      strategy: {kind: "rerun_final_gate", hypothesis_id: "review_evidence_unchanged", variant_id: "final_gate_v1"},
      action_id: "rerun_final_gate", outcome: "blocked", outcome_basis: "gate_result",
      reentry: {kind: "review_evidence_changed", reference_digest: digest("exact-review-findings")},
    }));
    const next = mergeObservations(current, memoryIdentity(current), values);
    expect(next.memory.records).toHaveLength(1);
    expect(next.memory.records[0]).toMatchObject({pr_number: null, task_id: null, observation_count: 7, first_seen: at(1), last_seen: at(7)});
  });

  it("keeps evidence and strategy identities separate", () => {
    const other = {...strategy(), kind: "manual_deterministic_repair"};
    const next = add(add(empty()), observation(2, {strategy: other}));
    expect(next.memory.records).toHaveLength(2);
    expect(new Set(next.memory.records.map((r: {evidence_fingerprint: string}) => r.evidence_fingerprint)).size).toBe(1);
    expect(new Set(next.memory.records.map((r: {strategy_fingerprint: string}) => r.strategy_fingerprint)).size).toBe(2);
    expect(fingerprintStrategy(strategy())).not.toBe(fingerprintStrategy({...strategy(), variant_id: "different_prompt_v2"}));
    expect(fingerprintStrategy(strategy())).not.toBe(fingerprintStrategy({...strategy(), hypothesis_id: "different_hypothesis"}));
  });

  it("keeps materially changed evidence distinct on the same HEAD", () => {
    const next = add(add(empty()), observation(2, {evidence: {...evidence(), signals: [signal("different-provider-error")]}}));
    expect(next.memory.records).toHaveLength(2);
    expect(next.memory.records.every((r: {observed_head: string}) => r.observed_head === head)).toBe(true);
  });

  it("retains changed HEAD provenance without changing the pattern", () => {
    const next = add(add(empty()), observation(2, {head: "b".repeat(40)}));
    expect(next.memory.records).toHaveLength(1);
    expect(next.memory.records[0].observations.map((o: {head: string}) => o.head)).toEqual(["b".repeat(40), head]);
    expect(next.memory.records[0].observed_head).toBe("b".repeat(40));
  });

  it.each([
    {outcome: "no_change", outcome_basis: "strategy_result"},
    {action_id: "different_action"},
    {stop: {kind: "review_blocked", reference_digest: null}},
    {reentry: {kind: "new_failure_fingerprint", reference_digest: null}},
    {reentry: {kind: "provider_availability_changed", reference_digest: digest("new-condition")}},
  ])("keeps changed outcomes/actions/conditions distinct: %j", (change) => {
    expect(add(add(empty()), observation(2, change)).memory.records).toHaveLength(2);
  });

  it("does not infer successful strategy outcome from workflow success", () => {
    expect(() => add(empty(), observation(1, {outcome: "succeeded", outcome_basis: "workflow_success"}))).toThrow();
    expect(() => add(empty(), observation(1, {outcome: "succeeded", outcome_basis: "unknown"}))).toThrow();
    expect(add(empty(), observation(1, {outcome: "succeeded", outcome_basis: "strategy_result"})).memory.records[0].outcome).toBe("succeeded");
    expect(add(empty(), observation(1, {outcome: "unknown", outcome_basis: "unknown"})).memory.records[0].outcome).toBe("unknown");
  });

  it("excludes timestamps and run/job provenance from pattern fingerprints", () => {
    const next = add(add(empty()), observation(3, {observed_at: at(30),
      source: {kind: "actions", run_id: 999, attempt: 9, job_id: 888}}));
    expect(next.memory.records).toHaveLength(1);
    expect(next.memory.records[0].observation_count).toBe(2);
  });

  it("canonicalizes descriptor ordering and duplicate descriptors without fuzzy stripping", () => {
    const a = {...signal("assertion-A"), path: "src/a.ts"};
    const b = {...signal("assertion-B"), path: "src/b.ts"};
    expect(fingerprintEvidence({...evidence(), signals: [a, b, a]}))
      .toBe(fingerprintEvidence({...evidence(), signals: [b, a]}));
    expect(fingerprintEvidence({...evidence(), signals: [a]}))
      .not.toBe(fingerprintEvidence({...evidence(), signals: [{...a, path: "src/A.ts"}]}));
    expect(normalizeEvidence({...evidence(), signals: [a, a]}).signals).toHaveLength(1);
  });

  it("preserves material provider class and explicit stale-head relationships", () => {
    expect(fingerprintEvidence(evidence())).not.toBe(fingerprintEvidence({...evidence(), provider_class: "rate_limited"}));
    const first = {...evidence(), stale_heads: {observed_head: head, current_head: "a".repeat(40)}};
    expect(fingerprintEvidence(first)).not.toBe(fingerprintEvidence({...first, stale_heads: {...first.stale_heads, current_head: "b".repeat(40)}}));
  });
});

describe("bounded deterministic retention and optimistic replacement", () => {
  it("prunes to newest 16 observations/records and cannot grow a comment unboundedly", () => {
    const values = fill(40, true);
    const next = mergeObservations(empty(), memoryIdentity(empty()), values);
    expect(next.memory.records).toHaveLength(LIMITS.records);
    expect(next.memory.records.reduce((sum: number, r: {observation_count: number}) => sum + r.observation_count, 0)).toBe(16);
    expect(next.memory.records.every((r: {first_seen: string}) => r.first_seen >= at(25))).toBe(true);
    expect(Buffer.byteLength(serializeMemory(next.memory))).toBeLessThanOrEqual(LIMITS.body_bytes);
    expect(add(next, values[0])).toEqual(next); // replay of evicted older evidence is not new activity
  });

  it("caps observation counters and exposes first/last of retained evidence", () => {
    const next = mergeObservations(empty(), memoryIdentity(empty()), fill(40));
    expect(next.memory.records[0]).toMatchObject({observation_count: 16, first_seen: at(25), last_seen: at(40)});
  });

  it("makes batch ordering and repeated input independent of serialization", () => {
    const values = fill(30, true);
    const a = mergeObservations(empty(), memoryIdentity(empty()), values);
    const b = mergeObservations(empty(), memoryIdentity(empty()), [...values].reverse().concat(values));
    expect(serializeMemory(a.memory)).toBe(serializeMemory(b.memory));
    const reversed = structuredClone(a.memory);
    reversed.records.reverse();
    expect(serializeMemory(reversed)).toBe(serializeMemory(a.memory));
  });

  it("uses deterministic ID tie-breaking when evidence times match", () => {
    const values = fill(30, true).map((o) => ({...o, observed_at: at(10)}));
    expect(mergeObservations(empty(), memoryIdentity(empty()), values))
      .toEqual(mergeObservations(empty(), memoryIdentity(empty()), values.reverse()));
  });

  it("rejects stale revision, digest or persistent comment identity", () => {
    const current = empty();
    const expected = memoryIdentity(current);
    const next = add(current);
    expect(() => mergeObservation(next, expected, observation(2))).toThrow("stale_memory");
    expect(() => mergeObservation(next, {...memoryIdentity(next), digest: expected.digest}, observation(2))).toThrow("stale_memory");
    expect(() => mergeObservation({...next, comment_id: 999}, memoryIdentity(next), observation(2))).toThrow("stale_memory");
    expect(() => mergeObservation(next, {...memoryIdentity(next), revision: 0}, observation(2))).toThrow("stale_memory");
  });

  it("does not mutate caller inputs or silently wrap exhausted revisions", () => {
    const current = empty(), value = observation();
    const before = JSON.stringify({current, value});
    add(current, value);
    expect(JSON.stringify({current, value})).toBe(before);
    const next = add(current);
    next.memory.revision = LIMITS.revision;
    expect(add(next, value)).toEqual(next);
    expect(() => add(next, observation(2))).toThrow("revision_exhausted");
  });
});

describe("trusted persisted-state boundary", () => {
  it("ignores marker-spoofing user/owner comments", () => {
    const body = serializeMemory(add(empty()).memory);
    expect(read([{...bot(body), user: {login: "ibboabdoli-ai", type: "User"}}])).toEqual(empty());
    expect(read([{...bot(body), user: {login: "github-actions[bot]", type: "User"}}])).toEqual(empty());
    expect(read([bot(body), {...bot(body, 999), user: {login: "attacker", type: "User"}}]).comment_id).toBe(123);
  });

  it("requires complete comments and the expected repository/issue provenance", () => {
    const comment = bot(serializeMemory(empty().memory));
    expect(() => read([comment], {complete: false})).toThrow("incomplete_comments");
    expect(() => read([{...comment, issue_url: comment.issue_url.replace("/548", "/549")}])).toThrow("comment_provenance");
    expect(() => read([{...comment, issue_url: "https://attacker.invalid/repos/ibboabdoli-ai/Proffera/issues/548"}])).toThrow();
    expect(() => read([{...comment, id: 0}])).toThrow();
  });

  it("rejects duplicate markers and duplicate authoritative comments", () => {
    const body = serializeMemory(empty().memory);
    expect(() => read([bot(body + "\n" + memoryMarker(repo, scope))])).toThrow("duplicate_marker");
    expect(() => read([bot(body), bot(body, 456)])).toThrow("ambiguous_comments");
    expect(() => read([bot(body), bot(body)])).toThrow("ambiguous_comments");
  });

  it("allows other valid task scopes without merging or inventing task identity", () => {
    const other = createMemory(repo, {kind: "task", task_id: "SUP-A2-OTHER"});
    expect(read([bot(serializeMemory(other))])).toEqual(empty());
    const headScope = {kind: "head", head};
    const current = {comment_id: null, memory: createMemory(repo, headScope)};
    const next = add(current, observation(1, {pr_number: null}));
    expect(next.memory.records[0]).toMatchObject({task_id: null, pr_number: null, observed_head: head});
    expect(() => add(current, observation(1, {pr_number: null, head: "a".repeat(40)}))).toThrow("head_scope_mismatch");
  });

  it("binds known task scope to canonical task identity", () => {
    const current = {comment_id: null, memory: createMemory(repo, {kind: "task", task_id: "SUP-A2"})};
    expect(() => add(current)).toThrow("task_mismatch");
    expect(add(current, observation(1, {task_id: "SUP-A2"})).memory.records[0].task_id).toBe("SUP-A2");
    expect(() => add(empty(), observation(1, {task_id: "INVENTED"}))).toThrow("task_mismatch");
    expect(() => add(empty(), observation(1, {pr_number: 0}))).toThrow();
    expect(() => add(empty(), observation(1, {pr_number: 879}))).toThrow("pr_mismatch");
  });

  it.each([
    (body: string) => body.replace('"schema_version":1', '"schema_version":2'),
    (body: string) => body.replace(":v1:", ":v2:"),
    (body: string) => body.slice(0, -5),
    (body: string) => body.replace('"records":[]', '"records":['),
    (body: string) => body.replace('"revision":0', '"revision":0,"revision":0'),
    (body: string) => body.replace('"revision":0', '"unexpected":true,"revision":0'),
    (body: string) => "extra prose\n" + body,
  ])("rejects malformed, interrupted, unsupported or noncanonical persisted bodies", (change) => {
    expect(() => read([bot(change(serializeMemory(empty().memory)))])).toThrow();
  });

  it("rejects a canonical document for the wrong repository", () => {
    const other = createMemory("other/project", scope);
    expect(() => read([bot(serializeMemory(other))])).toThrow("repository_mismatch");
    expect(() => add(empty(), observation(1, {repository: "other/project"}))).toThrow("repository_mismatch");
  });

  it("rejects forged fingerprints, IDs, counters and inconsistent observations", () => {
    const current = add(empty());
    for (const field of ["id", "evidence_fingerprint", "strategy_fingerprint"]) {
      const memory = structuredClone(current.memory);
      memory.records[0][field] = "0".repeat(64);
      expect(() => serializeMemory(memory)).toThrow("fingerprint_mismatch");
    }
    const counter = structuredClone(current.memory);
    counter.records[0].observation_count = 999;
    expect(() => serializeMemory(counter)).toThrow("observation_metadata");
    const duplicate = structuredClone(current.memory);
    duplicate.records.push(duplicate.records[0]);
    expect(() => serializeMemory(duplicate)).toThrow("record_collision");
    const collision = structuredClone(current.memory);
    collision.records[0].observations.push({...collision.records[0].observations[0], last_seen: at(10)});
    expect(() => serializeMemory(collision)).toThrow("observation_collision");
    const changedHead = structuredClone(current.memory);
    changedHead.records[0].observations[0].head = "a".repeat(40);
    expect(() => serializeMemory(changedHead)).toThrow("observation_collision");
  });
});

describe("content safety and closed input schema", () => {
  it.each(["bad-sha", "a".repeat(39), "A".repeat(40)])("rejects malformed/noncanonical SHA %s", (bad) => {
    expect(() => add(empty(), observation(1, {head: bad}))).toThrow("digest_or_sha");
  });

  it.each(["ghp_verySensitiveTokenValue", "sk-secret-credential", "Bearer token", "secret\nsecond-line",
    "\u001b[31merror\u001b[0m", "<!-- proffera-supervisor-failure-memory:v1 -->", "https://temp.invalid/token",
    "password=secret", "full prompt with private user data"])("rejects raw/private/control content as identifiers", (bad) => {
    expect(() => add(empty(), observation(1, {action_id: bad}))).toThrow("public_identifier_required");
  });

  it("rejects raw log/env/prompt fields instead of silently discarding semantic input", () => {
    expect(() => add(empty(), {...observation(), log: "private payload"})).toThrow("fields");
    expect(() => fingerprintEvidence({...evidence(), timestamp: at(1)})).toThrow("fields");
    expect(() => fingerprintEvidence({...evidence(), run_id: 1})).toThrow("fields");
    expect(() => fingerprintStrategy({...strategy(), prompt: "private prompt"})).toThrow("fields");
    expect(() => fingerprintEvidence({...evidence(), signals: [{...signal(), detail_digest: null}]})).toThrow();
    expect(() => fingerprintEvidence({...evidence(), signals: []})).toThrow("signals_bound");
  });

  it("rejects oversized inputs without truncating fingerprints", () => {
    expect(() => add(empty(), observation(1, {action_id: "a".repeat(49)}))).toThrow();
    expect(() => fingerprintEvidence({...evidence(), signals: Array(5).fill(signal())})).toThrow("signals_bound");
    expect(() => fingerprintEvidence({...evidence(), signals: [{...signal(), path: "src/" + "a".repeat(121)}]})).toThrow();
    expect(() => mergeObservations(empty(), memoryIdentity(empty()), fill(65))).toThrow("batch_bound");
    expect(() => read([bot(memoryMarker(repo, scope) + "x".repeat(LIMITS.body_bytes))])).toThrow("body_bound");
  });

  it("requires real UTC evidence times and rejects impossible calendar dates", () => {
    expect(() => add(empty(), observation(1, {observed_at: "2026-02-30T00:00:00Z"}))).toThrow("timestamp");
    expect(() => add(empty(), observation(1, {observed_at: "yesterday"}))).toThrow("timestamp");
    expect(() => add(empty(), observation(1, {observed_at: null}))).toThrow("timestamp");
  });

  it("matches A1 category terminology without importing its I/O adapter", () => {
    expect(FAILURE_CATEGORIES).toEqual(["workflow_invalid", "browser_failure", "unit_contract_failure",
      "review_blocked", "provider_unavailable", "stale_evidence", "cancelled", "unknown"]);
    const source = readFileSync(new URL("../scripts/supervisor-failure-memory.mjs", import.meta.url), "utf8");
    expect(source.match(/^import .+ from .+;$/gm)).toEqual(['import { createHash } from "node:crypto";']);
  });
});
