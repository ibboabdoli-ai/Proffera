import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone Node .mjs follows the existing control-plane test convention.
import { acceptFinalGateRetry, decideFinalGateRetry, ensureFinalGateMemory, listFinalGateRetryIntents, markFinalGateUncertain, normalizeFinalGateEvidence, recoverAcceptedFinalGateIntent } from "../scripts/supervisor-final-gate-memory.mjs";

const repo = "ibboabdoli-ai/Proffera";
const pr = 878;
const head = "a".repeat(40);
const at = (n: number) => new Date(Date.UTC(2026, 9, 1, 8, 0, 0) + n * 1000).toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function bot(body: string, id = 123) {
  return {
    id,
    body,
    user: { login: "github-actions[bot]", type: "Bot" },
    issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/548",
  };
}
function baseInput(comments: Array<Record<string, unknown>>) {
  return { repository: repo, pr_number: pr, comments, comments_complete: true };
}
function source(
  id = 9001,
  body = "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa",
  reviewGenerationId = 7001,
) {
  return {
    kind: "issue_comment",
    id,
    actor: "chatgpt-codex-connector[bot]",
    observed_at: at(3),
    review_commit: null,
    body,
    review_state: "",
    review_generation_id: reviewGenerationId,
  };
}
function target(attempt = 1, id = 77) {
  return {
    workflow_path: ".github/workflows/ci.yml",
    run_id: 500,
    head,
    run_attempt: attempt,
    job: {
      id,
      run_id: 500,
      head,
      run_attempt: attempt,
      name: "E2E public smoke",
      status: "completed",
      conclusion: "failure",
      started_at: at(1),
      completed_at: at(2),
    },
  };
}
function recovery(attempt = 1) {
  const jobs = [target().job];
  if (attempt === 2) jobs.push({ ...target(2, 78).job, started_at: at(6), completed_at: at(7) });
  return {
    repository: repo,
    pr_number: pr,
    run_id: 500,
    head,
    workflow_path: ".github/workflows/ci.yml",
    run_attempt: attempt,
    complete: true,
    observed_at: at(8),
    jobs,
  };
}
function persistedV2() {
  const ensured = ensureFinalGateMemory(baseInput([]));
  expect(ensured.action).toBe("create");
  return [bot(ensured.persistence.body)];
}
function prepare(comments = persistedV2(), src: ReturnType<typeof source> & { findings?: Array<{path: string; body: string}> } = source(), recoveryEvidence = recovery(), retryTarget = target()) {
  return decideFinalGateRetry({
    ...baseInput(comments),
    source: src,
    target: retryTarget,
    prepared_at: at(4),
    recovery_evidence: recoveryEvidence,
  });
}

describe("canonical material evidence", () => {
  it("keys an owner fallback request by its exact marker, independent of prose, ID and edits", () => {
    const request = { ...source(), actor: "ibboabdoli-ai", body: "<!-- proffera-codex-fallback-review-request:" + head + " -->\n@codex review" };
    const first = normalizeFinalGateEvidence(request, head);
    expect(normalizeFinalGateEvidence({ ...request, id: 999, observed_at: at(4), body: "Please review.\n" + request.body + "\nThanks." }, head)).toEqual(first);
    expect(() => normalizeFinalGateEvidence(request, "b".repeat(40))).toThrow("unsupported_evidence");
  });
  it("converges clean review/comment transports without a generation guess", () => {
    for (const actor of ["coderabbitai[bot]", "chatgpt-codex-connector[bot]"]) {
      const reviewed = { ...source(), actor, kind: "pull_request_review", review_commit: head, review_state: actor === "coderabbitai[bot]" ? "commented" : "approved", body: "Review completed.", findings: [] };
      const comment = { ...source(), actor, body: actor === "coderabbitai[bot]" ? "Review completed for exact HEAD " + head + ".\nI found no material findings." : source().body };
      expect(normalizeFinalGateEvidence(reviewed, head)).toEqual(normalizeFinalGateEvidence(comment, head));
      expect(normalizeFinalGateEvidence({ ...reviewed, id: 55, review_generation_id: 888 }, head)).toEqual(normalizeFinalGateEvidence(reviewed, head));
      expect(normalizeFinalGateEvidence({ ...comment, review_generation_id: null }, head)).toEqual(normalizeFinalGateEvidence(reviewed, head));
    }
  });
  it("keeps genuine finding edits and new heads material, but ignores finding transport IDs and ordering", () => {
    const finding = { id: 1, path: "scripts/example.mjs", line: 7, body: "Reject unsafe HEAD" };
    const reviewed = { ...source(), kind: "pull_request_review", review_commit: head, review_state: "commented", findings: [finding] };
    const first = normalizeFinalGateEvidence(reviewed, head);
    expect(normalizeFinalGateEvidence({ ...reviewed, id: 99, findings: [{ ...finding, id: 99 }] }, head)).toEqual(first);
    expect(normalizeFinalGateEvidence({ ...reviewed, findings: [{ ...finding, body: "Reject unsafe JOB" }] }, head)).not.toEqual(first);
    expect(normalizeFinalGateEvidence({ ...reviewed, review_commit: "b".repeat(40) }, "b".repeat(40))).not.toEqual(first);
    expect(() => normalizeFinalGateEvidence(reviewed, "b".repeat(40))).toThrow("review_head");
  });
  it("does not erase case, URLs or finding content while normalizing transport whitespace", () => {
    const withFinding = (body: string) => normalizeFinalGateEvidence({ ...source(), findings: [{ path: "a", body }] }, head);
    expect(withFinding("URL https://example.com/a")).not.toEqual(withFinding("URL https://example.com/b"));
    expect(withFinding("wrong HEAD")).not.toEqual(withFinding("wrong head"));
    expect(withFinding("wrong  HEAD")).toEqual(withFinding("wrong HEAD"));
  });
  it("rejects generic skipped/disabled status and distinguishes recognized availability from clean decisions", () => {
    const provider = { ...source(), actor: "coderabbitai[bot]" };
    for (const body of ["Review skipped", "Review skipped: automatic reviews are disabled"]) {
      expect(() => normalizeFinalGateEvidence({ ...provider, body }, head)).toThrow("unsupported_evidence");
    }
    expect(normalizeFinalGateEvidence({ ...provider, body: "Review rate limited. Try again later." }, head)).toMatchObject({ category: "provider_unavailable", provider_class: "rate_limited" });
    expect(normalizeFinalGateEvidence({ ...provider, body: "Service unavailable" }, head)).toMatchObject({ provider_class: "unavailable" });
    expect(() => normalizeFinalGateEvidence({ ...source(), actor: "attacker" }, head)).toThrow("unsupported_evidence");
  });
});

describe("final-gate retry decisions", () => {
  it("requires explicit v2 initialization", () => {
    const ensured = ensureFinalGateMemory(baseInput([]));
    expect(ensured.action).toBe("create");
    expect(ensured.persistence.body).toContain("proffera-supervisor-failure-memory:v2:");
  });

  it("allows first evidence and produces PREPARED", () => {
    const decision = prepare();
    expect(decision.decision).toBe("ALLOW_RERUN");
    expect(decision.intent_id).toMatch(/^[0-9a-f]{64}$/);
    expect(decision.binding_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(decision.persistence.body).toContain('"state":"PREPARED"');
  });

  it("different event ID cannot buy a second equivalent intent", () => {
    const first = prepare();
    const duplicate = prepare([bot(first.persistence.body)], source(9999), recovery());
    expect(duplicate.decision).toBe("FAIL_CLOSED_UNCERTAIN");
    expect(duplicate.intent_id).toBe(first.intent_id);
  });

  it("fresh exact-head review evidence for a new reviewed head creates a new intent", () => {
    const first = prepare();
    const newTarget = target();
    newTarget.head = "b".repeat(40);
    newTarget.job.head = newTarget.head;
    const fresh = prepare([bot(first.persistence.body)], source(9999, "Codex Review: Didn't find any major issues. Reviewed commit: bbbbbbb", 7002), recovery(), newTarget);
    expect(fresh.decision).toBe("ALLOW_RERUN");
    expect(fresh.intent_id).not.toBe(first.intent_id);
  });

  it("material review change does not replace an unresolved target intent", () => {
    const first = prepare();
    const changed = prepare([bot(first.persistence.body)], { ...source(9999), findings: [{ path: "a", body: "different finding" }] }, recovery());
    expect(changed.decision).toBe("FAIL_CLOSED_UNCERTAIN");
    expect(changed.intent_id).toBe(first.intent_id);
  });

  it("provider outage on a newer exact head creates a new intent", () => {
    const outage = { ...source(9300), actor: "coderabbitai[bot]", body: "Review rate limited. Try again later." };
    const first = decideFinalGateRetry({
      ...baseInput(persistedV2()),
      source: outage,
      target: target(),
      prepared_at: at(4),
    });
    expect(first.decision).toBe("ALLOW_RERUN");

    const nextTarget = structuredClone(target(1, 78));
    nextTarget.head = "b".repeat(40);
    nextTarget.job.head = nextTarget.head;
    const second = decideFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      source: { ...outage, id: 9301 },
      target: nextTarget,
      prepared_at: at(5),
    });
    expect(second.decision).toBe("ALLOW_RERUN");
    expect(second.intent_id).not.toBe(first.intent_id);
  });

  it("persists explicit HTTP 201 acceptance", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: { http_status: 201, binding_digest: first.binding_digest, observed_at: at(5) },
    });
    expect(accepted.persistence.body).toContain('"state":"ACCEPTED"');
  });

  it("accepts a fast successor reported in the same second as the pre-POST lower bound", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: {
        http_status: 201,
        binding_digest: first.binding_digest,
        observed_at: "2026-10-01T08:00:04.900Z",
      },
    });
    const fastSuccessor = recovery(2);
    fastSuccessor.jobs[1] = {
      ...fastSuccessor.jobs[1],
      started_at: "2026-10-01T08:00:04.000Z",
      completed_at: "2026-10-01T08:00:06.000Z",
    };
    const recovered = decideFinalGateRetry({
      ...baseInput([bot(accepted.persistence.body)]),
      source: source(9002),
      target: target(),
      prepared_at: at(9),
      recovery_evidence: fastSuccessor,
    });
    expect(recovered.decision).toBe("RECOVERED_CONSUMED");
  });

  it("recovers the immediate successor even when a later rerun attempt already exists", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: { http_status: 201, binding_digest: first.binding_digest, observed_at: at(5) },
    });
    const laterReruns = recovery(3);
    laterReruns.jobs = [
      target().job,
      { ...target(2, 78).job, started_at: at(6), completed_at: at(7) },
      { ...target(3, 79).job, started_at: at(8), completed_at: at(8) },
    ];
    laterReruns.observed_at = at(9);

    const recovered = recoverAcceptedFinalGateIntent({
      ...baseInput([bot(accepted.persistence.body)]),
      intent_id: first.intent_id,
      recovery_evidence: laterReruns,
    });
    expect(recovered.decision).toBe("RECOVERED_CONSUMED");
    expect(recovered.persistence?.body).toContain('"state":"CONSUMED"');
    expect(recovered.persistence?.body).toContain('"run_attempt":2');
  });

  it("recovers a receipt-bearing UNCERTAIN intent once its exact successor becomes visible", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: { http_status: 201, binding_digest: first.binding_digest, observed_at: at(5) },
    });
    const uncertain = markFinalGateUncertain({
      ...baseInput([bot(accepted.persistence.body)]),
      intent_id: first.intent_id,
      reason: "insufficient_evidence",
      observed_at: at(6),
    });
    expect(uncertain.persistence.body).toContain('"state":"UNCERTAIN"');

    const recovered = recoverAcceptedFinalGateIntent({
      ...baseInput([bot(uncertain.persistence.body)]),
      intent_id: first.intent_id,
      recovery_evidence: recovery(2),
    });
    expect(recovered.decision).toBe("RECOVERED_CONSUMED");
    expect(recovered.persistence?.body).toContain('"state":"CONSUMED"');
  });

  it("recovers accepted evidence to CONSUMED and suppresses later duplicate", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: { http_status: 201, binding_digest: first.binding_digest, observed_at: at(5) },
    });
    const recovered = decideFinalGateRetry({
      ...baseInput([bot(accepted.persistence.body)]),
      source: source(9002),
      target: target(),
      prepared_at: at(9),
      recovery_evidence: recovery(2),
    });
    expect(recovered.decision).toBe("RECOVERED_CONSUMED");

    const suppressed = decideFinalGateRetry({
      ...baseInput([bot(recovered.persistence.body)]),
      source: source(9003),
      target: target(),
      prepared_at: at(10),
      recovery_evidence: recovery(2),
    });
    expect(suppressed.decision).toBe("SUPPRESS_DUPLICATE");
  });

  it("missing acceptance evidence remains fail closed", () => {
    const first = prepare();
    const uncertain = decideFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      source: source(9002),
      target: target(),
      prepared_at: at(9),
      recovery_evidence: recovery(2),
    });
    expect(uncertain.decision).toBe("FAIL_CLOSED_UNCERTAIN");
    expect(uncertain.persistence.body).toContain('"state":"UNCERTAIN"');
  });

  it("records POST failure uncertainty", () => {
    const first = prepare();
    for (const reason of ["post_failed", "acceptance_unknown"]) {
      const result = markFinalGateUncertain({
        ...baseInput([bot(first.persistence.body)]),
        intent_id: first.intent_id,
        reason,
        observed_at: at(5),
      });
      expect(result.persistence.body).toContain('"state":"UNCERTAIN"');
      expect(result.persistence.body).toContain(reason);
    }
  });

  it("fails closed on mismatched recovery", () => {
    const first = prepare();
    const accepted = acceptFinalGateRetry({
      ...baseInput([bot(first.persistence.body)]),
      intent_id: first.intent_id,
      receipt: { http_status: 201, binding_digest: first.binding_digest, observed_at: at(5) },
    });
    const mismatch = decideFinalGateRetry({
      ...baseInput([bot(accepted.persistence.body)]),
      source: source(9002),
      target: target(),
      prepared_at: at(9),
      recovery_evidence: { ...recovery(2), run_id: 999 },
    });
    expect(mismatch.decision).toBe("FAIL_CLOSED_MISMATCH");
  });

  it("reclaims confirmed accepted intents before unresolved capacity can accumulate", () => {
    let comments = persistedV2();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const prepared = prepare(
        comments,
        { ...source(9100 + i), findings: [{ path: "a", body: "finding " + i }] },
        recovery(),
        { ...target(), run_id: 500 + i, job: { ...target().job, run_id: 500 + i } },
      );
      const accepted = acceptFinalGateRetry({
        ...baseInput([bot(prepared.persistence.body)]),
        intent_id: prepared.intent_id,
        receipt: { http_status: 201, binding_digest: prepared.binding_digest, observed_at: at(5) },
      });
      comments = [bot(accepted.persistence.body)];
      ids.push(prepared.intent_id);
    }
    expect(listFinalGateRetryIntents(baseInput(comments)).filter((intent: {state: string}) => intent.state === "ACCEPTED")).toHaveLength(4);

    for (const [index, intentId] of ids.entries()) {
      const recovered = recoverAcceptedFinalGateIntent({
        ...baseInput(comments),
        intent_id: intentId,
        recovery_evidence: { ...recovery(2), run_id: 500 + index, jobs: recovery(2).jobs.map(j => ({ ...j, run_id: 500 + index })) },
      });
      expect(recovered.decision).toBe("RECOVERED_CONSUMED");
      if (recovered.persistence) comments = [bot(recovered.persistence.body)];
    }

    expect(listFinalGateRetryIntents(baseInput(comments)).filter((intent: {state: string}) => intent.state === "ACCEPTED")).toHaveLength(0);
    const fifth = prepare(
      comments,
      { ...source(9200), findings: [{ path: "a", body: "finding five" }] },
      recovery(),
    );
    expect(fifth.decision).toBe("ALLOW_RERUN");
  });

  it("keeps event provenance outside material evidence", () => {
    expect(hash(JSON.stringify(normalizeFinalGateEvidence(source(1), head)))).toBe(hash(JSON.stringify(normalizeFinalGateEvidence(source(2), head))));
  });
});

// The transport is the only simulated layer. Every decision, durable state
// transition, reread, recovery selection and POST boundary uses the real adapter.
// @ts-expect-error Standalone Node helper uses the repository .mjs test convention.
import { runLiveFinalGate } from "../scripts/supervisor-final-gate-live.mjs";

type LiveSource = Omit<ReturnType<typeof source>, "review_commit"> & { review_commit: string | null };
type ReviewRecord = { id: number; user: { login: string }; commit_id: string; state: string; submitted_at: string; body: string };
type FindingRecord = { id: number; user: { login: string }; commit_id: string; original_commit_id: string; pull_request_review_id: number; path: string; line: number; body: string; created_at: string };
type RawJob = Omit<ReturnType<typeof target>["job"], "conclusion" | "completed_at"> & { head_sha: string; conclusion: string | null; completed_at: string | null };
type Intent = { id: string; state: string; acceptance: { observed_at: string } | null; proof: { run_attempt: number } | null };
type Operation = { endpoint: string; method: string; body?: string };
type Hooks = { before?: (op: Operation) => void; post?: () => string; persist?: (body: string) => void; reply?: (endpoint: string, payload: unknown) => unknown };
const fallbackBody = `<!-- proffera-codex-fallback-review-request:${head} -->\n@codex review`;
const cleanBody = `<!-- CodeRabbit review command invocation: v2:${"c".repeat(64)} -->\nFinal exact-head review is complete for ${head}.\nI found no issues.`;
const otherCleanBody = `Review completed for exact HEAD ${head}.\nI found no material findings.`;
const liveReview = (id = 7001, state = "commented"): LiveSource => ({ ...source(id, "Review completed.", id), actor: "coderabbitai[bot]", observed_at: at(12), kind: "pull_request_review", review_commit: head, review_state: state });
const rawJob = (attempt = 1): RawJob => ({ ...target(attempt, 76 + attempt).job, head_sha: head, started_at: at(attempt * 10), completed_at: at(attempt * 10 + 1) });
const reviewRecord = (id = 7001, state = "COMMENTED", time = at(12)): ReviewRecord => ({ id, user: { login: "coderabbitai[bot]" }, commit_id: head, state, submitted_at: time, body: "Review completed." });
const findingRecord = (id = 8001, reviewId = 7001, body = "Validate the returned HEAD"): FindingRecord => ({ id, user: { login: "coderabbitai[bot]" }, commit_id: head, original_commit_id: head, pull_request_review_id: reviewId, path: "scripts/example.mjs", line: 7, body, created_at: at(12) });

function liveFixture(src: LiveSource = { ...source(9001, fallbackBody), actor: "ibboabdoli-ai" }, binding = { head, runId: 500 }) {
  const liveHead = binding.head, liveRunId = binding.runId;
  const boundJob = (attempt = 1) => ({ ...rawJob(attempt), head: liveHead, head_sha: liveHead, run_id: liveRunId });
  const boundFallback = `<!-- proffera-codex-fallback-review-request:${liveHead} -->\n@codex review`;
  const f = {
    src: { ...src, observed_at: at(12) }, sourceCreatedAt: at(12),
    all: [] as ReturnType<typeof bot>[], jobs: [boundJob()], posts: 0, time: 15,
    ops: [] as Array<Operation & { states: string[] }>, snapshots: [] as string[], verifiedPrepared: false,
    hooks: {} as Hooks, reviews: [] as ReviewRecord[], inline: [] as FindingRecord[],
    prHead: liveHead, draft: false,
    runMeta: { id: liveRunId, head_sha: liveHead, run_attempt: 1, path: ".github/workflows/ci.yml", event: "pull_request", repository: { full_name: repo }, pull_requests: [{ number: pr }] },
    prComments: [
      { id: 101, user: { login: "github-actions[bot]" }, body: `<!-- proffera-coderabbit-final-review-request:${liveHead} -->\n@coderabbitai review`, created_at: at(3) },
      { id: 102, user: { login: "ibboabdoli-ai" }, body: boundFallback, created_at: at(5) },
    ],
  };
  const memory = (): { intents: Intent[]; intent_admission_closed: boolean } | null => f.all.length ? JSON.parse(f.all[0].body.split("\n")[2]) : null;
  const states = () => memory()?.intents.map((intent) => intent.state) ?? [];
  const input = (attempt = f.runMeta.run_attempt) => {
    const job = structuredClone(f.jobs.find((j) => j.run_attempt === attempt && j.name === "E2E public smoke")!);
    const { head_sha: _rawHead, ...boundJob } = job;
    void _rawHead;
    return { repository: repo, pr_number: pr, source: structuredClone(f.src), target: { workflow_path: ".github/workflows/ci.yml", run_id: liveRunId, head: liveHead, run_attempt: attempt, job: boundJob } };
  };
  const execute = (file: string, args: string[]) => {
    expect(file).toBe("gh");
    const endpoint = args.find((arg) => arg.startsWith("repos/"));
    if (!endpoint) throw new Error("Unsimulated endpoint");
    const method = args.includes("--method") ? args[args.indexOf("--method") + 1] : "GET";
    const body = args.find((arg) => arg.startsWith("body="))?.slice(5);
    const op = { endpoint, method, body };
    f.ops.push({ ...op, states: states() });
    f.hooks.before?.(op);
    if (endpoint.endsWith("/rerun")) {
      expect(method).toBe("POST");
      expect(f.verifiedPrepared).toBe(true);
      expect(states()).toContain("PREPARED");
      f.posts++;
      return f.hooks.post?.() ?? "HTTP/2.0 201 Created\n{}";
    }
    let payload: unknown;
    if (method !== "GET") {
      if (!endpoint.includes("/issues/") || !body) throw new Error("Unexpected write");
      f.hooks.persist?.(body);
      f.all = [bot(body)];
      f.snapshots.push(body);
      f.verifiedPrepared = false;
      payload = f.all[0];
    } else if (endpoint.includes("/issues/548/comments")) {
      payload = f.all;
      if (states().includes("PREPARED")) f.verifiedPrepared = true;
    } else if (endpoint === `repos/${repo}/issues/comments/123`) payload = f.all[0];
    else if (endpoint === `repos/${repo}/issues/comments/${f.src.id}` || endpoint === `repos/${repo}/pulls/${pr}/reviews/${f.src.id}`) {
      payload = { id: f.src.id, user: { login: f.src.actor }, issue_url: `https://api.github.com/repos/${repo}/issues/${pr}`, body: f.src.body, created_at: f.sourceCreatedAt, updated_at: f.src.observed_at, submitted_at: f.src.observed_at, commit_id: f.src.review_commit, state: f.src.review_state.toUpperCase() };
    } else if (endpoint === `repos/${repo}/pulls/${pr}`) {
      payload = { number: pr, state: "open", draft: f.draft, head: { sha: f.prHead }, base: { repo: { full_name: repo } } };
    } else if (endpoint === `repos/${repo}/actions/runs/${liveRunId}`) payload = f.runMeta;
    else if (/\/actions\/jobs\/\d+$/.test(endpoint)) payload = f.jobs.find((j) => j.id === Number(endpoint.split("/").at(-1)));
    else if (endpoint.includes(`/actions/runs/${liveRunId}/jobs`)) payload = { total_count: f.jobs.length, jobs: f.jobs };
    else if (endpoint.includes(`/pulls/${pr}/reviews?`)) payload = f.reviews;
    else if (endpoint.includes(`/pulls/${pr}/comments?`)) payload = f.inline;
    else if (endpoint.includes(`/issues/${pr}/comments?`)) payload = f.prComments;
    else if (!f.hooks.reply) throw new Error(`Unsimulated ${method} ${endpoint}`);
    return (args.includes("--include") ? "HTTP/2.0 200 OK\r\n\r\n" : "") + JSON.stringify(f.hooks.reply ? f.hooks.reply(endpoint, payload) : payload);
  };
  return Object.assign(f, {
    input, memory, states,
    capacity: () => 4 - (memory()?.intents.filter((i) => i.state !== "CONSUMED").length ?? 0),
    next() { f.runMeta.run_attempt++; f.jobs.push(boundJob(f.runMeta.run_attempt)); f.time = f.runMeta.run_attempt * 10 + 5; },
    run(value = input()) { return runLiveFinalGate(value, execute, () => at(f.time)); },
  });
}

describe("real adapter identity and event ordering", () => {
  it.each(["prose", "edit", "event_id"])("equivalent fallback %s cannot purchase another POST", (mode) => {
    const f = liveFixture(); f.run(); const id = f.memory()!.intents[0].id; f.next();
    if (mode === "event_id") f.src.id++;
    else { f.src.body = `Please review.\n${fallbackBody}\nThanks.`; f.src.observed_at = at(23); }
    expect(f.run().decision).toBe("SUPPRESS_DUPLICATE");
    expect(f.posts).toBe(1); expect(f.memory()!.intents[0].id).toBe(id); expect(f.capacity()).toBe(4);
  });
  it.each(["review_first", "comment_first", "older_review_visible", "other_comment_format", "edited_comment"])("clean semantic evidence converges: %s", (mode) => {
    const comment = { ...source(), actor: "coderabbitai[bot]", body: mode === "other_comment_format" ? otherCleanBody : cleanBody };
    const f = liveFixture(mode === "review_first" ? liveReview() : comment);
    if (mode === "older_review_visible") f.reviews = [reviewRecord(6001, "COMMENTED", at(6))];
    f.run(); f.next(); f.src = mode === "review_first" || mode === "edited_comment" ? { ...comment, id: 999, observed_at: at(23) } : liveReview(7002);
    f.reviews.push(reviewRecord(7002));
    expect(f.run().decision).toBe("SUPPRESS_DUPLICATE"); expect(f.posts).toBe(1);
  });
  it("accepts a fresh exact-head Codex clean comment with no visible review, then deduplicates the delayed review", () => {
    const f = liveFixture(source()); f.run(); f.next(); f.src = { ...liveReview(7002, "approved"), actor: "chatgpt-codex-connector[bot]" };
    expect(f.run().decision).toBe("SUPPRESS_DUPLICATE"); expect(f.posts).toBe(1);
  });
  it("same findings with different IDs deduplicate, actual content edits remain material", () => {
    const f = liveFixture(liveReview()); f.inline = [findingRecord()]; f.run(); f.next();
    f.src = liveReview(7002); f.inline = [findingRecord(999, 7002)];
    expect(f.run().decision).toBe("SUPPRESS_DUPLICATE"); expect(f.posts).toBe(1);
    f.inline[0].body = "Validate the returned RUN";
    expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(2);
  });
  it("a later approval clearing changed blocking content is new authority, shared with its clean comment", () => {
    const f = liveFixture(liveReview()); f.run(); f.next();
    f.reviews = [reviewRecord(8001, "CHANGES_REQUESTED", at(16))];
    expect(() => f.run()).toThrow("review_changed"); expect(f.posts).toBe(1);
    f.reviews.push(reviewRecord(8002, "APPROVED", at(22))); f.src = liveReview(8002, "approved"); f.src.observed_at = at(22);
    expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(2);
    f.next(); f.src = { ...source(8003), actor: "coderabbitai[bot]", body: cleanBody, observed_at: at(33) };
    expect(f.run().decision).toBe("SUPPRESS_DUPLICATE"); expect(f.posts).toBe(2);
  });
  it.each(["missing_primary", "wrong_primary_actor", "early_fallback", "old_edited_codex", "wrong_comment_pr", "stale_review_head", "draft"])("rejects stale/untrusted authority: %s", (mode) => {
    const f = liveFixture(mode === "old_edited_codex" ? source() : undefined);
    if (mode === "missing_primary") f.prComments.shift();
    if (mode === "wrong_primary_actor") f.prComments[0].user.login = "attacker";
    if (mode === "early_fallback") f.sourceCreatedAt = at(2);
    if (mode === "old_edited_codex") f.sourceCreatedAt = at(4);
    if (mode === "wrong_comment_pr") f.hooks.reply = (p, v) => p.includes(`/issues/comments/${f.src.id}`) ? { ...(v as object), issue_url: `https://api.github.com/repos/${repo}/issues/999` } : v;
    if (mode === "stale_review_head") { f.src = liveReview(); f.src.review_commit = "b".repeat(40); }
    if (mode === "draft") f.draft = true;
    expect(() => f.run()).toThrow(); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4);
  });
});

describe("real adapter owned pre-POST failure boundary", () => {
  it.each(["source", "head", "job", "run_attempt", "blocking_review", "source_throw", "head_throw", "job_throw", "run_throw", "review_throw", "review_page_throw", "new_findings"])("safely releases owned intent after %s and permits stable delivery", (mode) => {
    const f = liveFixture(mode === "new_findings" ? liveReview() : undefined);
    const original = f.input();
    f.hooks.before = ({ endpoint }) => {
      if (!f.states().includes("PREPARED")) return;
      if (mode === "source" && endpoint.includes(`/issues/comments/${f.src.id}`)) f.src.body += " edited";
      if (mode === "head" && endpoint === `repos/${repo}/pulls/${pr}`) f.prHead = "b".repeat(40);
      if (mode === "job" && endpoint.includes("/actions/jobs/")) f.jobs[0].completed_at = at(13);
      if (mode === "run_attempt" && endpoint === `repos/${repo}/actions/runs/500`) f.runMeta.run_attempt = 2;
      if (mode === "blocking_review" && endpoint.includes(`/pulls/${pr}/reviews?`)) f.reviews = [reviewRecord(8001, "CHANGES_REQUESTED", at(14))];
      if (mode === "new_findings" && endpoint.includes(`/pulls/${pr}/comments?`)) f.inline = [findingRecord()];
      const throws: Record<string, boolean> = { source_throw: endpoint.includes(`/issues/comments/${f.src.id}`), head_throw: endpoint === `repos/${repo}/pulls/${pr}`, job_throw: endpoint.includes("/actions/jobs/"), run_throw: endpoint === `repos/${repo}/actions/runs/500`, review_throw: endpoint.includes(`/pulls/${pr}/reviews?`), review_page_throw: endpoint.includes(`/pulls/${pr}/reviews?`) && endpoint.endsWith("page=2") };
      if (throws[mode]) throw new Error("simulated pre-POST read failure");
    };
    if (mode === "review_page_throw") f.hooks.reply = (p, v) => f.states().includes("PREPARED") && p.includes(`/pulls/${pr}/reviews?`) ? Array.from({ length: 100 }, (_, i) => reviewRecord(2000 + i)) : v;
    expect(f.run(original).decision).toBe("FAIL_CLOSED_MISMATCH"); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4); expect(f.states()).toEqual([]);
    f.hooks = {}; f.prHead = head; f.runMeta.run_attempt = 1; f.jobs = [rawJob()]; f.reviews = []; f.inline = [];
    expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(1);
  });
  it("repeated safe read failures cannot exhaust unresolved capacity", () => {
    const f = liveFixture();
    f.hooks.before = ({ endpoint }) => { if (f.states().includes("PREPARED") && endpoint.includes(`/issues/comments/${f.src.id}`)) throw new Error("read failure"); };
    for (let i = 0; i < 8; i++) { f.src.id++; expect(f.run().decision).toBe("FAIL_CLOSED_MISMATCH"); expect(f.capacity()).toBe(4); }
    expect(f.posts).toBe(0); f.hooks = {}; f.run(); expect(f.posts).toBe(1);
  });
  it("never posts on durable-write verification failure", () => {
    const f = liveFixture(); f.hooks.reply = (p, v) => p.includes("/issues/548/comments") && f.states().includes("PREPARED") ? [] : v;
    expect(() => f.run()).toThrow("persistence_identity"); expect(f.posts).toBe(0); expect(f.states()).toEqual(["PREPARED"]);
  });
  it("does not release if a conflicting writer changed persisted identity", () => {
    const f = liveFixture();
    f.hooks.before = ({ endpoint }) => {
      if (f.states().includes("PREPARED") && endpoint.includes(`/issues/comments/${f.src.id}`)) {
        const payload = JSON.parse(f.all[0].body.split("\n")[2]); payload.revision++;
        f.all[0].body = f.all[0].body.replace(/\n\{[^\n]+\}\n/, "\n" + JSON.stringify(payload) + "\n");
        throw new Error("source read failed");
      }
    };
    expect(() => f.run()).toThrow("release_ownership_lost"); expect(f.posts).toBe(0); expect(f.states()).toEqual(["PREPARED"]);
  });
});

describe("real adapter POST uncertainty and recovery", () => {
  it.each(["rejected", "response_lost", "crash_before_receipt", "receipt_write_failed", "receipt_verification_failed"])("preserves uncertainty and suppresses replay after %s", (mode) => {
    const f = liveFixture();
    if (mode === "rejected") f.hooks.post = () => { throw Object.assign(new Error("rejected"), { stdout: "HTTP/2.0 422 Unprocessable Entity" }); };
    if (mode === "response_lost") f.hooks.post = () => { throw new Error("accepted remotely, response lost"); };
    if (mode === "crash_before_receipt") f.hooks.before = ({ endpoint }) => { if (f.posts && endpoint.includes("/issues/548/comments")) throw new Error("simulated crash"); };
    if (mode === "receipt_write_failed") f.hooks.persist = (body) => { if (body.includes('"state":"ACCEPTED"')) throw new Error("receipt persistence failed"); };
    if (mode === "receipt_verification_failed") f.hooks.reply = (p, v) => p.includes("/issues/548/comments") && f.states().includes("ACCEPTED") ? [] : v;
    if (["rejected", "response_lost"].includes(mode)) expect(f.run().decision).toBe("FAIL_CLOSED_UNCERTAIN"); else expect(() => f.run()).toThrow();
    expect(f.posts).toBe(1); f.hooks = {}; f.next(); f.src.body += "\nEquivalent edited prose";
    f.run(); expect(f.posts).toBe(1);
    expect(f.states()).toEqual([mode === "receipt_verification_failed" ? "CONSUMED" : "UNCERTAIN"]);
  });
  it("receipt-bearing UNCERTAIN recovers when N+1 becomes visible", () => {
    const f = liveFixture(); f.run(); expect(f.memory()!.intents[0].acceptance?.observed_at).toBe(at(15));
    f.run(); expect(f.states()).toEqual(["UNCERTAIN"]); f.next(); f.run(); expect(f.states()).toEqual(["CONSUMED"]); expect(f.posts).toBe(1);
  });
  it.each(["N+1", "N+2", "same_second"])("recovers the exact retained successor: %s", (mode) => {
    const f = liveFixture(); if (mode === "same_second") f.time = 15.9;
    f.run(); f.next(); if (mode === "N+2") f.next();
    if (mode === "same_second") f.jobs[1].started_at = at(15);
    f.run(); expect(f.states()).toEqual(["CONSUMED"]); expect(f.memory()!.intents[0].proof?.run_attempt).toBe(2); expect(f.posts).toBe(1);
  });
  it.each(["missing_baseline", "cloned_start", "duplicate_successor", "claimed_N+2", "receiptless"])("keeps incomplete/ambiguous recovery pinned: %s", (mode) => {
    const f = liveFixture();
    if (mode === "receiptless") f.hooks.post = () => { throw new Error("timeout"); };
    f.run(); f.hooks = {}; f.next();
    if (mode === "missing_baseline") f.jobs.shift();
    if (mode === "cloned_start") f.jobs[1].started_at = f.jobs[0].started_at;
    if (mode === "duplicate_successor") f.jobs.push({ ...rawJob(2), id: 999 });
    if (mode === "claimed_N+2") f.runMeta.run_attempt = 3;
    f.run(f.input(2)); expect(f.states()).toEqual(["UNCERTAIN"]); expect(f.posts).toBe(1); expect(f.capacity()).toBe(3);
  });
  it.each(["complete", "incomplete", "changed_total", "duplicate_id"])("validates multi-page job recovery: %s", (mode) => {
    const f = liveFixture(); f.run(); f.next();
    f.hooks.reply = (p, v) => {
      if (!p.includes("/actions/runs/500/jobs")) return v;
      const page = new URL("https://offline.invalid/" + p).searchParams.get("page");
      return { total_count: mode === "changed_total" && page === "2" ? 102 : 101, jobs: page === "1" ? [f.jobs[0], ...Array.from({ length: 99 }, (_, i) => ({ ...rawJob(), id: i + 1000, name: "other" }))] : mode === "incomplete" ? [] : [mode === "duplicate_id" ? f.jobs[0] : f.jobs[1]] };
    };
    if (mode === "complete") { f.run(); expect(f.states()).toEqual(["CONSUMED"]); }
    else { expect(() => f.run()).toThrow(/pagination/); expect(f.states()).toEqual(["ACCEPTED"]); }
    expect(f.posts).toBe(1);
  });
  it.each(["run_id", "run_head", "run_repo", "run_pr", "job_run", "job_head", "job_attempt"])("rejects contradictory raw GitHub identity: %s", (mode) => {
    const f = liveFixture();
    const original = f.input();
    if (mode === "run_id") f.runMeta.id = 501;
    if (mode === "run_head") f.runMeta.head_sha = "b".repeat(40);
    if (mode === "run_repo") f.runMeta.repository.full_name = "another/repo";
    if (mode === "run_pr") f.runMeta.pull_requests = [{ number: 999 }];
    if (mode === "job_run") f.jobs[0].run_id = 501;
    if (mode === "job_head") f.jobs[0].head_sha = "b".repeat(40);
    if (mode === "job_attempt") f.jobs[0].run_attempt = 2;
    expect(() => f.run(original)).toThrow(/identity/); expect(f.posts).toBe(0);
  });
  it("authoritative newer run attempt prevents POST before its final job exists", () => {
    const f = liveFixture(); const original = f.input(); f.runMeta.run_attempt = 2;
    f.jobs.push({ ...rawJob(2), name: "Validate", status: "in_progress", conclusion: null, completed_at: null });
    expect(f.run(original).decision).toBe("FAIL_CLOSED_MISMATCH"); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4);
  });
  it("uncertain effects stay pinned without spending capacity on evidence churn", () => {
    const f = liveFixture(liveReview()); f.hooks.post = () => { throw new Error("response lost"); };
    for (let i = 0; i < 4; i++) { f.inline = [findingRecord(8000 + i, 7001, "different finding " + i)]; f.run(); }
    expect(f.posts).toBe(1); expect(f.capacity()).toBe(3);
    f.inline = [findingRecord(9000, 7001, "fifth finding")];
    expect(f.run().decision).toBe("FAIL_CLOSED_UNCERTAIN"); expect(f.posts).toBe(1); expect(f.capacity()).toBe(3);
  });
  it("retains the existing bounded terminal eviction/admission-closure contract", () => {
    const f = liveFixture(liveReview());
    for (let i = 0; i < 9; i++) { f.inline = [findingRecord(8000 + i, 7001, "finding " + i)]; f.run(); f.next(); f.run(); }
    expect(f.posts).toBe(9); expect(f.memory()!.intents).toHaveLength(8); expect(f.memory()!.intent_admission_closed).toBe(true);
    f.inline = [findingRecord(9999, 7001, "tenth")]; expect(() => f.run()).toThrow("intent_admission_closed");
  });
});

describe("real adapter provider and blocking-review policy", () => {
  it.each(["Review skipped", "Review skipped: automatic reviews are disabled", "Action not completed: pull request is in draft mode", "A rate-limit discussion"])("does not classify generic status as an outage: %s", (body) => {
    const f = liveFixture({ ...source(), actor: "coderabbitai[bot]", body }); expect(() => f.run()).toThrow(); expect(f.posts).toBe(0);
  });
  it.each(["Review limit reached", "Review rate limited", "Action not completed: Review rate limited", "Service unavailable", "Temporarily unavailable"])("accepts authenticated post-primary availability evidence: %s", (body) => {
    const f = liveFixture({ ...source(), actor: "coderabbitai[bot]", body }); expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(1);
    const stale = liveFixture({ ...source(), actor: "coderabbitai[bot]", body }); stale.sourceCreatedAt = at(2); expect(() => stale.run()).toThrow("primary_request_required"); expect(stale.posts).toBe(0);
  });
  it.each(["direct_review", "codex_comment", "fallback_request", "outage", "coderabbit_comment"])("blocks a newly arrived CHANGES_REQUESTED on every path: %s", (mode) => {
    const sources: Record<string, LiveSource> = { direct_review: liveReview(), codex_comment: source(), fallback_request: { ...source(9001, fallbackBody), actor: "ibboabdoli-ai" }, outage: { ...source(), actor: "coderabbitai[bot]", body: "Review rate limited" }, coderabbit_comment: { ...source(), actor: "coderabbitai[bot]", body: cleanBody } };
    const f = liveFixture(sources[mode]); f.hooks.before = ({ endpoint }) => { if (f.states().includes("PREPARED") && endpoint.includes(`/pulls/${pr}/reviews?`)) f.reviews = [reviewRecord(888, "CHANGES_REQUESTED", at(14))]; };
    expect(f.run().decision).toBe("FAIL_CLOSED_MISMATCH"); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4);
  });
});

describe("authority transitions and late races", () => {
  it.each(["approved", "clean_comment"])("Codex COMMENTED cannot consume the later %s authority", (mode) => {
    const f = liveFixture({ ...liveReview(), actor: "chatgpt-codex-connector[bot]" });
    expect(() => f.run()).toThrow("codex_decision_pending"); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4);
    f.src = mode === "approved" ? { ...liveReview(7002, "approved"), actor: "chatgpt-codex-connector[bot]" } : { ...source(), observed_at: at(12) };
    expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(1);
  });
  it.each(["head", "attempt"])("refreshes %s after slow review pagination", (mode) => {
    const f = liveFixture();
    f.hooks.before = ({ endpoint }) => {
      if (!f.states().includes("PREPARED") || !endpoint.includes(`/issues/${pr}/comments?`)) return;
      if (mode === "head") f.prHead = "b".repeat(40); else f.runMeta.run_attempt = 2;
    };
    expect(f.run().decision).toBe("FAIL_CLOSED_MISMATCH"); expect(f.posts).toBe(0); expect(f.capacity()).toBe(4);
  });
  it("treats current Codex commit findings as blocking even when original_commit_id differs", () => {
    const f = liveFixture(source());
    f.inline = [{ ...findingRecord(), user: { login: "chatgpt-codex-connector[bot]" }, original_commit_id: "b".repeat(40) }];
    expect(() => f.run()).toThrow("clean_comment_findings"); expect(f.posts).toBe(0);
  });
  it("does not correlate a persistent summary to an older/ambiguous review ID", () => {
    const summary = `<!-- recent_review_start -->\nNo actionable comments were generated.\n${head}\n<!-- recent_review_end -->`;
    const f = liveFixture({ ...source(), actor: "coderabbitai[bot]", body: summary });
    expect(() => f.run()).toThrow("summary_completion_required"); expect(f.posts).toBe(0);
    f.reviews = [reviewRecord(6001, "COMMENTED", at(6)), reviewRecord(6002, "COMMENTED", at(7))];
    f.run(); f.next(); f.src = liveReview(7002); f.run(); expect(f.posts).toBe(1);
  });
});


describe("new HEAD authority through the real adapter", () => {
  it("does not suppress a new exact-head request after the previous head was consumed", () => {
    const old = liveFixture(); old.run(); old.next(); old.run(); expect(old.states()).toEqual(["CONSUMED"]);
    const newHead = "b".repeat(40);
    const fresh = liveFixture({ ...source(9900, "<!-- proffera-codex-fallback-review-request:" + newHead + " -->\n@codex review"), actor: "ibboabdoli-ai" }, {head: newHead, runId: 600});
    fresh.all = structuredClone(old.all); fresh.time = 35; fresh.sourceCreatedAt = at(32); fresh.src.observed_at = at(32);
    fresh.prComments[0].created_at = at(26); fresh.prComments[1].created_at = at(28);
    fresh.jobs[0].started_at = at(30); fresh.jobs[0].completed_at = at(31);
    expect(fresh.run().decision).toBe("ALLOW_RERUN"); expect(fresh.posts).toBe(1);
    expect(new Set(fresh.memory()!.intents.map(i => i.id)).size).toBe(2);
  });
});

describe("individually verified review visibility", () => {
  it.each(["missing_from_list", "later_blocker", "contradictory_list"])("reconciles an exact source review safely: %s", (mode) => {
    const f = liveFixture(liveReview(7002, "approved"));
    f.reviews = [{ ...reviewRecord(7001, "CHANGES_REQUESTED", at(6)), body: "Earlier blocking evidence" }];
    if (mode === "later_blocker") f.reviews.push(reviewRecord(7003, "CHANGES_REQUESTED", at(14)));
    if (mode === "contradictory_list") f.reviews.push(reviewRecord(7002, "CHANGES_REQUESTED", at(12)));
    if (mode === "missing_from_list") {
      expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(1);
      f.next(); f.reviews.push(reviewRecord(7002, "APPROVED", at(12)));
      expect(f.run().decision).toBe("SUPPRESS_DUPLICATE"); expect(f.posts).toBe(1);
    } else { expect(() => f.run()).toThrow(mode === "later_blocker" ? "review_changed" : "review_contradiction"); expect(f.posts).toBe(0); }
  });
});


describe("stabilization execution boundaries", () => {
  it("different material evidence cannot buy another POST on an uncertain target", () => {
    const f = liveFixture(liveReview());
    f.hooks.post = () => { throw new Error("response lost after remote acceptance"); };
    for (let i = 0; i < 3; i++) {
      f.inline = [findingRecord(9000 + i, 7001, "material finding " + i)];
      expect(f.run().decision).toBe("FAIL_CLOSED_UNCERTAIN");
    }
    expect(f.posts).toBe(1);
    expect(f.states()).toEqual(["UNCERTAIN"]);
    expect(f.capacity()).toBe(3);
  });

  it("an unavailable historical run stays pending without poisoning a new target", () => {
    const old = liveFixture(); old.run();
    const newHead = "b".repeat(40);
    const fresh = liveFixture({ ...liveReview(), review_commit: newHead }, {head: newHead, runId: 600});
    fresh.all = structuredClone(old.all); fresh.time = 35;
    fresh.hooks.before = ({ endpoint }) => {
      if (endpoint === "repos/" + repo + "/actions/runs/500") {
        throw Object.assign(new Error("historical run deleted"), {stdout: 'HTTP/2.0 404 Not Found\r\n\r\n{"message":"Not Found"}'});
      }
    };
    expect(fresh.run().decision).toBe("ALLOW_RERUN");
    expect(fresh.posts).toBe(1);
    expect(fresh.memory()!.intents.find(i => i.id === old.memory()!.intents[0].id)?.state).toBe("ACCEPTED");
  });
});


describe("unresolved execution target admission", () => {
  it.each(["PREPARED", "ACCEPTED", "UNCERTAIN", "receipt_uncertain", "receipt_write_failed", "receipt_verification_failed"])("locks %s against changed material evidence", (mode) => {
    const f = liveFixture(liveReview());
    if (mode === "PREPARED") f.hooks.before = ({ endpoint }) => { if (f.posts && endpoint.includes("/issues/548/comments")) throw new Error("crash after POST"); };
    if (mode === "UNCERTAIN") f.hooks.post = () => { throw new Error("response lost"); };
    if (mode === "receipt_write_failed") f.hooks.persist = body => { if (body.includes('"state":"ACCEPTED"')) throw new Error("receipt write failed"); };
    if (mode === "receipt_verification_failed") f.hooks.reply = (p, v) => p.includes("/issues/548/comments") && f.states().includes("ACCEPTED") ? [] : v;
    if (["PREPARED", "receipt_write_failed", "receipt_verification_failed"].includes(mode)) expect(() => f.run()).toThrow();
    else f.run();
    f.hooks = {};
    if (mode === "receipt_uncertain") f.run();
    const id = f.memory()!.intents[0].id;
    for (let i = 0; i < 8; i++) {
      f.inline = [findingRecord(9000 + i, 7001, "changed material finding " + i)];
      expect(f.run().decision).toBe("FAIL_CLOSED_UNCERTAIN");
      expect(f.memory()!.intents.map(i => i.id)).toEqual([id]);
      expect(f.posts).toBe(1); expect(f.capacity()).toBe(3);
    }
  });

  it("a receipt-less intent stays pinned when an independent exact HEAD proceeds", () => {
    const old = liveFixture(); old.hooks.post = () => { throw new Error("response lost"); }; old.run();
    const freshHead = "b".repeat(40);
    const fresh = liveFixture({ ...liveReview(), review_commit: freshHead }, {head: freshHead, runId: 600});
    fresh.all = structuredClone(old.all); fresh.time = 35;
    fresh.hooks.before = ({ endpoint }) => { if (endpoint === `repos/${repo}/actions/runs/500`) throw Object.assign(new Error("deleted"), {stdout: 'HTTP/2.0 404 Not Found\r\n\r\n{"message":"Not Found"}'}); };
    expect(fresh.run().decision).toBe("ALLOW_RERUN");
    expect(fresh.posts).toBe(1); expect(old.posts).toBe(1);
    expect(fresh.memory()!.intents.find(i => i.id === old.memory()!.intents[0].id)?.state).toBe("UNCERTAIN");
  });
});

describe("historical recovery transport classification", () => {
  it.each(["404", "410", "401", "403", "429", "500", "unknown", "malformed", "wrong_message", "identity", "null_payload", "pagination"])("isolates only proven unavailability: %s", (mode) => {
    const old = liveFixture(); old.run();
    const freshHead = "b".repeat(40);
    const fresh = liveFixture({ ...liveReview(), review_commit: freshHead }, {head: freshHead, runId: 600});
    fresh.all = structuredClone(old.all); fresh.time = 35;
    const saved = structuredClone(fresh.all);
    fresh.hooks.before = ({ endpoint }) => {
      if (endpoint !== `repos/${repo}/actions/runs/500`) return;
      const status = Number(mode);
      if (Number.isInteger(status)) throw Object.assign(new Error("API response " + mode), {stdout: `HTTP/2.0 ${status} status\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({message: status === 404 ? "Not Found" : status === 410 ? "Gone" : "failure"})}`});
      if (mode === "unknown") throw new Error("transport failure");
      if (mode === "malformed") throw Object.assign(new Error("bad response"), {stdout: 'HTTP/2.0 404 Not Found\r\n\r\nnot json'});
      if (mode === "wrong_message") throw Object.assign(new Error("permission ambiguity"), {stdout: 'HTTP/2.0 404 Not Found\r\n\r\n{"message":"Resource not accessible by integration"}'});
    };
    // Serve historical reads through the same transport adapter, including identity
    // and pagination negatives. No recovery/helper function is mocked.
    fresh.hooks.reply = (endpoint, payload) => {
      if (endpoint === `repos/${repo}/actions/runs/500`) return mode === "null_payload" ? null : mode === "identity" ? {...old.runMeta, head_sha: freshHead} : old.runMeta;
      if (endpoint.includes("/actions/runs/500/jobs")) return {total_count: 2, jobs: [old.jobs[0]]};
      return payload;
    };
    if (["404", "410"].includes(mode)) {
      expect(fresh.run().decision).toBe("ALLOW_RERUN"); expect(fresh.posts).toBe(1);
      expect(fresh.memory()!.intents.find(i => i.id === old.memory()!.intents[0].id)?.state).toBe("ACCEPTED");
    } else {
      expect(() => fresh.run()).toThrow(mode === "identity" ? /run_identity/ : mode === "pagination" ? /pagination_incomplete/ : undefined);
      expect(fresh.posts).toBe(0); expect(fresh.all).toEqual(saved);
    }
  });
});

describe("authority changes during final memory pagination", () => {
  it.each(["head", "run_attempt", "job", "source", "blocking_review"])("rejects %s observed during the last memory read and permits a stable delivery", (mode) => {
    const f = liveFixture();
    const original = f.input();
    let preparedReads = 0, paginating = false, injected = false;
    f.hooks.before = ({endpoint}) => {
      if (f.states().includes("PREPARED") && endpoint.includes("/issues/548/comments") && endpoint.endsWith("page=1")) preparedReads++;
    };
    f.hooks.reply = (endpoint, payload) => {
      if (!injected && preparedReads === 2 && endpoint.includes("/issues/548/comments")) {
        const page = new URL("https://offline.invalid/" + endpoint).searchParams.get("page");
        if (page === "1") {
          paginating = true;
          return [...f.all, ...Array.from({length: 99}, (_, i) => bot("Ordinary Supervisor context", 2000 + i))];
        }
        if (paginating && page === "2") {
          injected = true;
          if (mode === "head") f.prHead = "b".repeat(40);
          if (mode === "run_attempt") f.runMeta.run_attempt++;
          if (mode === "job") f.jobs[0].completed_at = at(13);
          if (mode === "source") f.src.body += " changed";
          if (mode === "blocking_review") f.reviews = [reviewRecord(8001, "CHANGES_REQUESTED", at(14))];
          return [];
        }
      }
      return payload;
    };
    expect(f.run(original).decision).toBe("FAIL_CLOSED_MISMATCH");
    expect(injected).toBe(true);
    expect(f.posts).toBe(0);
    expect(f.states()).toEqual([]);
    expect(f.capacity()).toBe(4);
    f.hooks = {}; f.prHead = head; f.runMeta.run_attempt = 1; f.jobs = [rawJob()]; f.src = original.source; f.reviews = [];
    expect(f.run().decision).toBe("ALLOW_RERUN");
    expect(f.posts).toBe(1);
  });
});
describe("bounded final memory and authority guards", () => {
  it.each(["conflict", "wrong_id", "wrong_author", "wrong_type", "wrong_scope", "missing", "read_failure"])("pins memory after %s at the final exact-comment guard", (mode) => {
    const f = liveFixture();
    let injected = false;
    f.hooks.before = ({endpoint, method}) => {
      if (mode === "conflict" && f.states().includes("PREPARED") && endpoint.includes(`/pulls/${pr}/reviews?`) && !injected) {
        const value = JSON.parse(f.all[0].body.split("\n")[2]); value.revision++;
        f.all[0].body = f.all[0].body.replace(/\n\{[^\n]+\}\n/, "\n" + JSON.stringify(value) + "\n");
        injected = true;
      }
      if (method === "GET" && endpoint === `repos/${repo}/issues/comments/123` && mode === "read_failure") throw new Error("memory read unavailable");
    };
    f.hooks.reply = (endpoint, payload) => {
      if (endpoint !== `repos/${repo}/issues/comments/123`) return payload;
      const value = structuredClone(f.all[0]);
      if (mode === "wrong_id") value.id++;
      if (mode === "wrong_author") value.user.login = "untrusted-user";
      if (mode === "wrong_type") value.user.type = "User";
      if (mode === "wrong_scope") value.issue_url = `https://api.github.com/repos/${repo}/issues/999`;
      return mode === "missing" ? null : value;
    };
    expect(() => f.run()).toThrow(mode === "read_failure" ? "memory read unavailable" : "persistence_identity");
    expect(f.posts).toBe(0); expect(f.states()).toEqual(["PREPARED"]); expect(f.capacity()).toBe(3);
  });

  it.each(["head", "run_attempt", "job", "source", "head_read_failure", "run_read_failure", "job_read_failure", "source_read_failure"])("rejects %s after the bounded memory guard", (mode) => {
    const f = liveFixture(); const original = f.input();
    let guarded = false;
    f.hooks.before = ({endpoint, method}) => {
      if (method === "GET" && endpoint === `repos/${repo}/issues/comments/123`) {
        guarded = true;
        if (mode === "head") f.prHead = "b".repeat(40);
        if (mode === "run_attempt") f.runMeta.run_attempt++;
        if (mode === "job") f.jobs[0].completed_at = at(13);
        if (mode === "source") f.src.body += " changed";
      }
      if (!guarded) return;
      const failed = mode === "head_read_failure" && endpoint === `repos/${repo}/pulls/${pr}`
        || mode === "run_read_failure" && endpoint === `repos/${repo}/actions/runs/500`
        || mode === "job_read_failure" && endpoint.includes("/actions/jobs/")
        || mode === "source_read_failure" && endpoint === `repos/${repo}/issues/comments/${f.src.id}`;
      if (failed) throw new Error("final authority read unavailable");
    };
    expect(f.run(original).decision).toBe("FAIL_CLOSED_MISMATCH");
    expect(guarded).toBe(true); expect(f.posts).toBe(0); expect(f.states()).toEqual([]); expect(f.capacity()).toBe(4);
  });
});
describe("review authority after the last memory read", () => {
  it.each(["blocking_review", "new_findings", "review_read_failure", "review_page_failure"])("rejects %s introduced during the exact-comment guard", (mode) => {
    const f = liveFixture(liveReview()); const original = f.input();
    let guarded = false;
    f.hooks.before = ({endpoint, method}) => {
      if (method === "GET" && endpoint === `repos/${repo}/issues/comments/123`) {
        guarded = true;
        if (mode === "blocking_review") f.reviews = [reviewRecord(8001, "CHANGES_REQUESTED", at(14))];
        if (mode === "new_findings") f.inline = [findingRecord()];
      }
      if (guarded && endpoint.includes(`/pulls/${pr}/reviews?`)
        && (mode === "review_read_failure" || mode === "review_page_failure" && endpoint.endsWith("page=2"))) {
        throw new Error("final review evidence unavailable");
      }
    };
    f.hooks.reply = (endpoint, payload) => guarded && mode === "review_page_failure" && endpoint.includes(`/pulls/${pr}/reviews?`)
      ? Array.from({length: 100}, (_, i) => reviewRecord(2000 + i)) : payload;
    expect(f.run(original).decision).toBe("FAIL_CLOSED_MISMATCH");
    expect(guarded).toBe(true); expect(f.posts).toBe(0); expect(f.states()).toEqual([]); expect(f.capacity()).toBe(4);
    f.hooks = {}; f.reviews = []; f.inline = [];
    expect(f.run().decision).toBe("ALLOW_RERUN"); expect(f.posts).toBe(1);
  });
});