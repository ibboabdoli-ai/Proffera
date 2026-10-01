import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone pure Node .mjs follows the existing control-plane test convention.
import { createMemory, memoryIdentity, memoryMarker, mergeObservation, mergeObservations, serializeMemory, readTrustedMemory, fingerprintEvidence, fingerprintStrategy, normalizeEvidence, FAILURE_CATEGORIES, LIMITS, upgradeMemory, prepareRetryIntent, transitionRetryIntent, decideRetryRecovery, RETRY_INTEGRATION } from "../scripts/supervisor-failure-memory.mjs";

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


const v2 = () => {
  const current = {...empty(), comment_id: 123};
  return upgradeMemory(current, memoryIdentity(current));
};
const target = () => ({workflow_path: ".github/workflows/ci.yml", run_id: 36622937789, head, run_attempt: 1,
  job: {id: 109595074592, run_id: 36622937789, head, run_attempt: 1, name: "E2E public smoke",
    status: "completed", conclusion: "failure", started_at: at(1), completed_at: at(2)}});
const intentInput = (n = 0) => ({repository: repo, pr_number: 878,
  evidence: {...evidence(), lane: "final_gate", signals: [signal("material-review-" + n)]},
  strategy: {...strategy(), kind: "rerun_final_gate"},
  target: target(), source: {kind: "issue_comment", id: 9001, actor: "coderabbitai[bot]",
    observed_at: at(3), review_commit: null, body_digest: digest("trusted-public-review")},
  prepared_at: at(4)});
const prepare = (current = v2(), input: unknown = intentInput()) => prepareRetryIntent(current, memoryIdentity(current), input);
const savedIntent = (current: ReturnType<typeof v2>, id: string) => current.memory.intents.find((i: {id: string}) => i.id === id);
const receipt = (current: ReturnType<typeof v2>, id: string) => ({http_status: 201,
  binding_digest: savedIntent(current, id).binding_digest, observed_at: at(5)});
const transition = (current: ReturnType<typeof v2>, id: string, event: unknown) =>
  transitionRetryIntent(current, memoryIdentity(current), id, event);
const accepted = (current: ReturnType<typeof v2>, id: string) => transition(current, id,
  {kind: "accepted", receipt: receipt(current, id)});
const jobEvidence = () => ({repository: repo, pr_number: 878, run_id: 36622937789, head,
  workflow_path: ".github/workflows/ci.yml", run_attempt: 2, complete: true, observed_at: at(8),
  jobs: [target().job, {...target().job, id: 109597951195, run_attempt: 2, started_at: at(6), completed_at: at(7)}]});
const consume = (current: ReturnType<typeof v2>, id: string) =>
  transition(current, id, {kind: "recover", evidence: jobEvidence()});

describe("D0 explicit v2 evolution and future integration boundary", () => {
  it("reads v1 unchanged and upgrades the same comment explicitly under its old identity", () => {
    const current = {...add(empty()), comment_id: 123};
    const body = serializeMemory(current.memory), identity = memoryIdentity(current);
    expect(read([bot(body)])).toEqual(current);
    const next = upgradeMemory(current, identity);
    expect(next.comment_id).toBe(123);
    expect(next.memory).toMatchObject({schema_version: 2, revision: current.memory.revision + 1,
      records: current.memory.records, intents: [], intent_admission_closed: false});
    expect(serializeMemory(current.memory)).toBe(body);
    expect(read([bot(serializeMemory(next.memory))])).toEqual(next);
    expect(upgradeMemory(next, memoryIdentity(next))).toEqual(next);
    expect(() => prepare(current)).toThrow("explicit_v2_upgrade_required");
    expect(() => upgradeMemory(next, identity)).toThrow("stale_memory");
  });

  it("fails closed on v1/v2 duplicates, version mismatch and unknown semantic fields", () => {
    const next = v2(), body = serializeMemory(next.memory);
    expect(() => read([bot(serializeMemory(empty().memory)), bot(body, 456)])).toThrow("ambiguous_comments");
    expect(() => read([bot(body.replace(":v2:", ":v1:"))])).toThrow("noncanonical_body");
    expect(() => read([bot(body.replace('"schema_version":2', '"schema_version":3'))])).toThrow("unsupported_version");
    expect(() => read([bot(body.replace('"intents":[]', '"intents":[],"retry":true'))])).toThrow("fields");
    expect(read([{...bot(body), user: {login: "attacker", type: "User"}}])).toEqual(empty());
  });

  it("restricts intent ownership to the same canonical PR-scoped memory document", () => {
    for (const s of [{kind: "task", task_id: "SUP-D0"}, {kind: "head", head}]) {
      const current = {comment_id: null, memory: createMemory(repo, s)};
      expect(() => prepare(upgradeMemory(current, memoryIdentity(current)))).toThrow("intent_requires_pr_scope");
    }
    expect(() => prepare(v2(), {...intentInput(), pr_number: 999})).toThrow("intent_scope_mismatch");
    expect(() => prepare(v2(), {...intentInput(), repository: "other/project"})).toThrow("intent_scope_mismatch");
  });

  it("defines non-cancelling PR serialization and PREPARED verification before the one POST", () => {
    expect(RETRY_INTEGRATION.scope).toBe("repository_pull_request");
    expect(RETRY_INTEGRATION.cancel_in_progress).toBe(false);
    expect(RETRY_INTEGRATION.order).toEqual(["validate_trusted_source", "validate_exact_target", "normalize_evidence",
      "read_trusted_memory", "check_existing_intent", "persist_prepared", "verify_persisted_identity",
      "revalidate_source_head_evidence_job", "post_once", "persist_confirmed_acceptance", "recover_from_github"]);
    // This contract does not alter the live workflow or add any I/O to the module.
    const source = readFileSync(new URL("../scripts/supervisor-failure-memory.mjs", import.meta.url), "utf8");
    expect(source.match(/^import .+ from .+;$/gm)).toEqual(['import { createHash } from "node:crypto";']);
  });
});

describe("D0 material identity, pinned binding and optimistic transitions", () => {
  it("creates one PREPARED intent, round-trips it and never mutates caller inputs", () => {
    const current = v2(), input = intentInput(), before = JSON.stringify({current, input});
    const next = prepare(current, input);
    expect(next.created).toBe(true);
    expect(savedIntent(next.snapshot, next.intent_id)).toMatchObject({state: "PREPARED", target: target(),
      acceptance: null, proof: null, prepared_at: at(4)});
    expect(read([bot(serializeMemory(next.snapshot.memory))])).toEqual(next.snapshot);
    expect(JSON.stringify({current, input})).toBe(before);
  });

  it("does not create seven intents for equivalent deliveries of the historical run", () => {
    let current = v2();
    const ids = new Set();
    for (let i = 0; i < 7; i++) {
      const input = intentInput();
      input.source.id += i;
      const result = prepare(current, input);
      expect(result.created).toBe(i === 0);
      ids.add(result.intent_id);
      current = result.snapshot;
    }
    expect(ids.size).toBe(1);
    expect(current.memory.intents).toHaveLength(1);
    expect(current.memory.intents[0].target.run_id).toBe(36622937789);
    expect(current.memory.intents[0].source.id).toBe(9001);
  });

  it.each([1, 3])("rejects baseline job attempt %s when the target run attempt is 2", (attempt) => {
    const input = intentInput();
    input.target.run_attempt = 2;
    input.target.job.run_attempt = attempt;
    expect(() => prepare(v2(), input)).toThrow("target_mismatch");
  });

  it("ignores event/head/target churn without retargeting the original material intent", () => {
    const first = prepare();
    const input = intentInput();
    input.source.id++;
    input.source.body_digest = digest("equivalent wrapper");
    input.target.head = "a".repeat(40);
    input.target.job.head = input.target.head;
    input.target.run_id++;
    input.target.job.run_id++;
    input.target.job.id++;
    const again = prepare(first.snapshot, input);
    expect(again).toEqual({...first, created: false});
  });

  it("preserves distinct material evidence and strategy variants on the same HEAD", () => {
    const first = prepare(), changed = prepare(first.snapshot, intentInput(1));
    const input = intentInput();
    input.strategy.variant_id = "different_gate_strategy_v2";
    const another = prepare(changed.snapshot, input);
    expect(new Set(another.snapshot.memory.intents.map((i: {id: string}) => i.id)).size).toBe(3);
  });

  it("deduplicates reordered evidence and preserves exact assertion differences", () => {
    const input = intentInput();
    input.evidence.signals = [signal("assertion-a"), signal("assertion-b")];
    const first = prepare(v2(), input);
    const reversed = {...input, evidence: {...input.evidence, signals: [...input.evidence.signals].reverse()}};
    expect(prepare(first.snapshot, reversed).created).toBe(false);
    expect(prepare(v2(), reversed)).toEqual(first);
    expect(prepare(first.snapshot, {...input, evidence: {...input.evidence, signals: [signal("assertion-c")]}}).created).toBe(true);
  });

  it("rejects concurrent stale preparations and stale digest/comment/revision transitions", () => {
    const current = v2(), expected = memoryIdentity(current), first = prepare(current);
    expect(() => prepareRetryIntent(first.snapshot, expected, intentInput(1))).toThrow("stale_memory");
    for (const mismatch of [{revision: 0}, {digest: "0".repeat(64)}, {comment_id: 999}]) {
      expect(() => transitionRetryIntent(first.snapshot, {...memoryIdentity(first.snapshot), ...mismatch}, first.intent_id,
        {kind: "uncertain", reason: "runner_interrupted", observed_at: at(5)})).toThrow("stale_memory");
    }
  });

  it("accepts only a bound explicit HTTP201 receipt and makes exact replay a no-op", () => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id);
    expect(savedIntent(next, first.intent_id).state).toBe("ACCEPTED");
    expect(accepted(next, first.intent_id)).toEqual(next);
    for (const change of [{http_status: 500}, {http_status: 200}, {binding_digest: "0".repeat(64)}, {observed_at: at(2)}]) {
      expect(() => transition(first.snapshot, first.intent_id, {kind: "accepted",
        receipt: {...receipt(first.snapshot, first.intent_id), ...change}})).toThrow();
    }
    expect(() => transitionRetryIntent(next, memoryIdentity(first.snapshot), first.intent_id,
      {kind: "accepted", receipt: receipt(first.snapshot, first.intent_id)})).toThrow("stale_memory");
  });

  it("rejects illegal/replayed transitions and never reopens terminal or uncertain intents", () => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id), done = consume(next, first.intent_id);
    expect(savedIntent(done, first.intent_id).state).toBe("CONSUMED");
    expect(consume(done, first.intent_id)).toEqual(done);
    expect(prepare(done).created).toBe(false);
    for (const current of [done, transition(first.snapshot, first.intent_id,
      {kind: "uncertain", reason: "post_failed", observed_at: at(5)})]) {
      expect(() => transition(current, first.intent_id, {kind: "prepared"})).toThrow("illegal_transition");
      expect(prepare(current).created).toBe(false);
    }
    expect(() => accepted(done, first.intent_id)).toThrow("illegal_transition");
    expect(() => transition(done, first.intent_id, {kind: "uncertain", reason: "post_failed", observed_at: at(9)})).toThrow();
    expect(() => transition(first.snapshot, "0".repeat(64), {kind: "prepared"})).toThrow("intent_missing");
  });
});

describe("D0 crash windows and conservative recovery", () => {
  it.each(["crash_before_post", "synchronous_post_failure", "accepted_post_then_crash",
    "accepted_persistence_failure", "comment_conflict", "runner_cancellation"])(
    "%s leaves durable PREPARED blocking a second equivalent intent", (failure) => {
      const first = prepare();
      let persisted = read([bot(serializeMemory(first.snapshot.memory))]);
      let postCalls = 0;
      // Model the documented future integration boundaries in memory, never GitHub.
      const attempt = () => {
        if (failure === "crash_before_post" || failure === "runner_cancellation") throw new Error("interrupted");
        postCalls++;
        if (failure === "synchronous_post_failure") throw new Error("post_rejected");
        if (failure === "accepted_post_then_crash") throw new Error("interrupted_after_201");
        if (failure === "comment_conflict") {
          const expected = memoryIdentity(persisted);
          persisted = add(persisted); // another writer changes the revision
          transitionRetryIntent(persisted, expected, first.intent_id,
            {kind: "accepted", receipt: receipt(first.snapshot, first.intent_id)});
          return;
        }
        const candidate = accepted(persisted, first.intent_id);
        expect(savedIntent(candidate, first.intent_id).state).toBe("ACCEPTED");
        throw new Error("comment_write_failed"); // candidate never becomes authoritative
      };
      expect(attempt).toThrow(failure === "comment_conflict" ? "stale_memory" : undefined);
      expect(postCalls).toBe(["crash_before_post", "runner_cancellation"].includes(failure) ? 0 : 1);
      // Duplicate admission cannot reach the simulated POST again.
      if (prepare(persisted).created) postCalls++;
      expect(postCalls).toBeLessThanOrEqual(1);
      expect(savedIntent(persisted, first.intent_id).state).toBe("PREPARED");
      expect(decideRetryRecovery(savedIntent(persisted, first.intent_id), jobEvidence()).decision).toBe("KEEP_UNCERTAIN");
      const recovered = consume(persisted, first.intent_id);
      expect(savedIntent(recovered, first.intent_id)).toMatchObject({state: "UNCERTAIN", acceptance: null});
      expect(prepare(recovered).created).toBe(false);
    });

  it("keeps a manual same-target rerun uncertain when no acceptance receipt survived", () => {
    const first = prepare();
    expect(decideRetryRecovery(savedIntent(first.snapshot, first.intent_id), jobEvidence()))
      .toEqual({decision: "KEEP_UNCERTAIN", proof: null});
  });

  it("confirms only recorded acceptance plus a new execution in the exact next attempt", () => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id);
    expect(decideRetryRecovery(savedIntent(next, first.intent_id), jobEvidence()).decision).toBe("CONFIRM_CONSUMED");
    const done = consume(next, first.intent_id);
    expect(savedIntent(done, first.intent_id)).toMatchObject({state: "CONSUMED", proof: {run_attempt: 2}});
    expect(read([bot(serializeMemory(done.memory))])).toEqual(done);
    const uncertain = transition(next, first.intent_id, {kind: "uncertain", reason: "runner_interrupted", observed_at: at(6)});
    expect(savedIntent(consume(uncertain, first.intent_id), first.intent_id).state).toBe("CONSUMED");
  });

  it("allows a later explicit acceptance receipt to resolve receipt-less uncertainty", () => {
    const first = prepare();
    const uncertain = transition(first.snapshot, first.intent_id, {kind: "uncertain", reason: "acceptance_unknown", observed_at: at(5)});
    expect(savedIntent(accepted(uncertain, first.intent_id), first.intent_id).state).toBe("ACCEPTED");
  });

  it.each([
    {repository: "other/project"}, {pr_number: 999}, {run_id: 999}, {head: "b".repeat(40)},
    {workflow_path: ".github/workflows/unrelated.yml"}, {observed_at: at(1)},
  ])("rejects unrelated/malformed recovery context %j", (change) => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id);
    expect(decideRetryRecovery(savedIntent(next, first.intent_id), {...jobEvidence(), ...change}).decision).toBe("REJECT_MISMATCH");
    expect(() => transition(next, first.intent_id, {kind: "recover", evidence: {...jobEvidence(), ...change}})).toThrow("recovery_mismatch");
  });

  it.each(["absent", "missing_baseline", "incomplete", "gap", "clone", "queued", "ambiguous", "before_receipt", "extra_attempt"])(
    "%s evidence cannot prove consumption or authorize another POST", (scenario) => {
      const first = prepare(), next = accepted(first.snapshot, first.intent_id), proof = jobEvidence();
      if (scenario === "absent") proof.jobs = [target().job];
      if (scenario === "missing_baseline") proof.jobs = proof.jobs.slice(1);
      if (scenario === "incomplete") proof.complete = false;
      if (scenario === "gap") { proof.run_attempt = 3; proof.jobs[1].run_attempt = 3; }
      if (scenario === "clone") { proof.jobs[1].started_at = at(1); proof.jobs[1].completed_at = at(2); }
      if (scenario === "queued") proof.jobs = [proof.jobs[0], {...proof.jobs[1], status: "queued", conclusion: null, started_at: null, completed_at: null}] as typeof proof.jobs;
      if (scenario === "ambiguous") proof.jobs.push({...proof.jobs[1], id: 555});
      if (scenario === "before_receipt") proof.jobs[1].started_at = at(4);
      if (scenario === "extra_attempt") proof.run_attempt = 3;
      expect(decideRetryRecovery(savedIntent(next, first.intent_id), proof).decision).toBe("KEEP_UNCERTAIN");
      const uncertain = transition(next, first.intent_id, {kind: "recover", evidence: proof});
      expect(savedIntent(uncertain, first.intent_id).state).toBe("UNCERTAIN");
      expect(prepare(uncertain).created).toBe(false);
    });

  it("rejects reused job IDs, mismatched baseline and malformed proof without timestamp-only recovery", () => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id), intent = savedIntent(next, first.intent_id);
    const reused = jobEvidence(); reused.jobs[1].id = reused.jobs[0].id;
    const baseline = jobEvidence(); baseline.jobs[0].started_at = at(0);
    const crossRun = jobEvidence(); crossRun.jobs[1].run_id++;
    const malformed = jobEvidence(); malformed.jobs[1].run_attempt = 0;
    for (const proof of [reused, baseline, crossRun, malformed, {...jobEvidence(), timestamp: at(9)}]) {
      expect(decideRetryRecovery(intent, proof).decision).toBe("REJECT_MISMATCH");
    }
  });

  it("normalizes recovery evidence ordering into one canonical witness", () => {
    const first = prepare(), next = accepted(first.snapshot, first.intent_id), proof = jobEvidence();
    expect(transition(next, first.intent_id, {kind: "recover", evidence: {...proof, jobs: [...proof.jobs].reverse()}}))
      .toEqual(consume(next, first.intent_id));
  });
});

describe("D0 bounded pinned retention and malformed state", () => {
  it("pins all unresolved states and refuses excess capacity instead of evicting them", () => {
    let current = v2();
    const ids: string[] = [];
    for (let i = 0; i < LIMITS.unresolved_intents; i++) {
      const result = prepare(current, intentInput(i)); current = result.snapshot; ids.push(result.intent_id);
    }
    current = accepted(current, ids[0]);
    current = transition(current, ids[1], {kind: "uncertain", reason: "runner_interrupted", observed_at: at(5)});
    const body = serializeMemory(current.memory);
    expect(() => prepare(current, intentInput(99))).toThrow("unresolved_capacity");
    expect(serializeMemory(current.memory)).toBe(body);
    const historical = mergeObservations(current, memoryIdentity(current), fill(40, true));
    expect(historical.memory.intents).toEqual(current.memory.intents);
    expect(read([bot(serializeMemory(historical.memory))]).memory.intents).toEqual(current.memory.intents);
  });

  it("prunes terminal history deterministically and permanently seals new admission against replay", () => {
    let current = v2();
    const pinned = prepare(current, intentInput(99)); current = pinned.snapshot;
    for (let i = 0; i <= LIMITS.terminal_intents; i++) {
      const result = prepare(current, intentInput(i));
      current = consume(accepted(result.snapshot, result.intent_id), result.intent_id);
    }
    expect(current.memory.intents.filter((i: {state: string}) => i.state === "CONSUMED")).toHaveLength(8);
    expect(savedIntent(current, pinned.intent_id).state).toBe("PREPARED");
    expect(current.memory.intent_admission_closed).toBe(true);
    const roundTrip = read([bot(serializeMemory(current.memory))]);
    expect(upgradeMemory(roundTrip, memoryIdentity(roundTrip))).toEqual(roundTrip);
    expect(() => prepare(roundTrip, intentInput(100))).toThrow("intent_admission_closed");
    const retained = new Set(current.memory.intents.map((i: {id: string}) => i.id));
    const retired = Array.from({length: 9}, (_, i) => intentInput(i)).find((input) => !retained.has(prepare(v2(), input).intent_id));
    expect(() => prepare(roundTrip, retired!)).toThrow("intent_admission_closed");
    expect(prepare(roundTrip, intentInput(99)).created).toBe(false);
    expect(consume(accepted(roundTrip, pinned.intent_id), pinned.intent_id).memory.intent_admission_closed).toBe(true);
    const reordered = structuredClone(current.memory); reordered.intents.reverse();
    expect(serializeMemory(reordered)).toBe(serializeMemory(current.memory));
    expect(Buffer.byteLength(serializeMemory(current.memory))).toBeLessThanOrEqual(LIMITS.body_bytes);
  });

  it("rejects forged IDs/bindings, duplicate identities, hidden fields and illegal persisted states", () => {
    const first = prepare();
    for (const field of ["id", "binding_digest", "evidence_fingerprint", "strategy_fingerprint"]) {
      const memory = structuredClone(first.snapshot.memory); memory.intents[0][field] = "0".repeat(64);
      expect(() => serializeMemory(memory)).toThrow("intent_fingerprint_mismatch");
    }
    const duplicate = structuredClone(first.snapshot.memory); duplicate.intents.push(duplicate.intents[0]);
    expect(() => serializeMemory(duplicate)).toThrow("intent_collision");
    const forgedState = structuredClone(first.snapshot.memory); forgedState.intents[0].state = "CONSUMED";
    expect(() => serializeMemory(forgedState)).toThrow("intent_state");
    const extra = structuredClone(first.snapshot.memory); extra.intents[0].raw_log = "private payload";
    expect(() => serializeMemory(extra)).toThrow("fields");
    const targetChanged = structuredClone(first.snapshot.memory); targetChanged.intents[0].target.job.id++;
    expect(() => serializeMemory(targetChanged)).toThrow("intent_fingerprint_mismatch");
  });

  it("rejects untrusted/malformed source claims, oversized proof and raw/private fields", () => {
    const input = intentInput();
    expect(() => prepare(v2(), {...input, source: {...input.source, actor: "attacker"}})).toThrow();
    expect(() => prepare(v2(), {...input, source: {...input.source, raw_review: "secret"}})).toThrow("fields");
    expect(() => prepare(v2(), {...input, evidence: {...input.evidence, signals: []}})).toThrow();
    expect(() => prepare(v2(), {...input, target: {...target(), run_attempt: 0}})).toThrow();
    expect(() => prepare(v2(), {...input, source: {...input.source, kind: "pull_request_review", review_commit: "a".repeat(40)}})).toThrow("source_mismatch");
    const first = prepare(), next = accepted(first.snapshot, first.intent_id);
    expect(decideRetryRecovery(savedIntent(next, first.intent_id), {...jobEvidence(), jobs: Array(33).fill(target().job)}).decision).toBe("REJECT_MISMATCH");
  });
});
