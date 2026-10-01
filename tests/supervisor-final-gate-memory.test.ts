import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone Node .mjs follows the existing control-plane test convention.
import { acceptFinalGateRetry, decideFinalGateRetry, ensureFinalGateMemory, markFinalGateUncertain, normalizeFinalGateEvidence } from "../scripts/supervisor-final-gate-memory.mjs";

const repo = "ibboabdoli-ai/Proffera";
const pr = 878;
const head = "a".repeat(40);
const at = (n: number) => new Date(Date.UTC(2026, 9, 1, 8, 0, n)).toISOString();
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
function source(id = 9001, body = "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa") {
  return {
    kind: "issue_comment",
    id,
    actor: "chatgpt-codex-connector[bot]",
    observed_at: at(3),
    review_commit: null,
    body,
    review_state: "",
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
function prepare(comments = persistedV2(), src = source(), recoveryEvidence = recovery()) {
  return decideFinalGateRetry({
    ...baseInput(comments),
    source: src,
    target: target(),
    prepared_at: at(4),
    recovery_evidence: recoveryEvidence,
  });
}

describe("final-gate material evidence normalization", () => {
  it("treats a fresh exact-head Codex result as material review evidence", () => {
    const first = normalizeFinalGateEvidence(source(1, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa"));
    const second = normalizeFinalGateEvidence(source(2, "Codex Review: Didn't find any major issues. Reviewed commit: bbbbbbb"));
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("keeps materially different review text distinct", () => {
    const first = normalizeFinalGateEvidence(source(1, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa"));
    const second = normalizeFinalGateEvidence(source(2, "Codex Review: Didn't find any major issues. Semantic note. Reviewed commit: aaaaaaa"));
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("preserves short hexadecimal finding identifiers as material evidence", () => {
    const first = normalizeFinalGateEvidence(source(1, "Codex Review: Didn't find any major issues. Finding deadbee. Reviewed commit: aaaaaaa"));
    const second = normalizeFinalGateEvidence(source(2, "Codex Review: Didn't find any major issues. Finding cafebabe. Reviewed commit: aaaaaaa"));
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("binds pull-request review evidence to its reviewed commit", () => {
    const base = {
      ...source(),
      kind: "pull_request_review",
      actor: "coderabbitai[bot]",
      body: "Review completed.",
      review_state: "commented",
    };
    const first = normalizeFinalGateEvidence({ ...base, review_commit: "a".repeat(40) });
    const second = normalizeFinalGateEvidence({ ...base, review_commit: "b".repeat(40) });
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("classifies CodeRabbit clean and provider outage evidence separately", () => {
    const clean = normalizeFinalGateEvidence({ ...source(), actor: "coderabbitai[bot]", body: "Final exact-head review is complete for aaaaaaa. I found no issues." });
    const outage = normalizeFinalGateEvidence({ ...source(), actor: "coderabbitai[bot]", body: "Review rate limited. Try again later." });
    expect(clean.signals[0].code).toBe("coderabbit_clean");
    expect(outage).toMatchObject({ category: "provider_unavailable", provider_class: "rate_limited" });
  });

  it("rejects unsupported evidence", () => {
    expect(() => normalizeFinalGateEvidence({ ...source(), actor: "attacker" })).toThrow("unsupported_evidence");
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
    const fresh = prepare([bot(first.persistence.body)], source(9999, "Codex Review: Didn't find any major issues. Reviewed commit: bbbbbbb"), recovery());
    expect(fresh.decision).toBe("ALLOW_RERUN");
    expect(fresh.intent_id).not.toBe(first.intent_id);
  });

  it("material review change creates an independent intent", () => {
    const first = prepare();
    const changed = prepare([bot(first.persistence.body)], source(9999, "Codex Review: Didn't find any major issues. Semantic repair B. Reviewed commit: aaaaaaa"), recovery());
    expect(changed.decision).toBe("ALLOW_RERUN");
    expect(changed.intent_id).not.toBe(first.intent_id);
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

  it("keeps event provenance outside material evidence", () => {
    expect(hash(JSON.stringify(normalizeFinalGateEvidence(source(1))))).toBe(hash(JSON.stringify(normalizeFinalGateEvidence(source(2)))));
  });
});
