import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone Node .mjs follows the existing control-plane test convention.
import { acceptFinalGateRetry, decideFinalGateRetry, ensureFinalGateMemory, listFinalGateRetryIntents, markFinalGateUncertain, normalizeFinalGateEvidence, recoverAcceptedFinalGateIntent } from "../scripts/supervisor-final-gate-memory.mjs";

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
function prepare(comments = persistedV2(), src = source(), recoveryEvidence = recovery()) {
  return decideFinalGateRetry({
    ...baseInput(comments),
    source: src,
    target: target(),
    prepared_at: at(4),
    recovery_evidence: recoveryEvidence,
  });
}

describe("final-gate live acceptance ordering", () => {
  it("captures HTTP 201 acceptance time before rereading Failure Memory comments", () => {
    const source = readFileSync(new URL("../scripts/supervisor-final-gate-live.mjs", import.meta.url), "utf8");
    const post = source.indexOf("const posted = postRerun(input, execute);");
    const acceptedAt = source.indexOf("const acceptedAt = now();", post);
    const reread = source.indexOf("all = comments(input.repository, execute);", acceptedAt);
    const receipt = source.indexOf("observed_at: acceptedAt", reread);
    expect(post).toBeGreaterThanOrEqual(0);
    expect(acceptedAt).toBeGreaterThan(post);
    expect(reread).toBeGreaterThan(acceptedAt);
    expect(receipt).toBeGreaterThan(reread);
  });
});

describe("final-gate material evidence normalization", () => {
  it("treats a fresh exact-head Codex review generation as material evidence", () => {
    const first = normalizeFinalGateEvidence(
      source(1, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa", 7001),
      head,
    );
    const second = normalizeFinalGateEvidence(
      source(2, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa", 7002),
      head,
    );
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("ignores transport text changes within the same review generation", () => {
    const first = normalizeFinalGateEvidence(
      source(1, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa", 7001),
      head,
    );
    const duplicate = normalizeFinalGateEvidence(
      source(2, "Codex Review: Didn't find any major issues. Semantic note. Reviewed commit: aaaaaaa", 7001),
      head,
    );
    expect(duplicate).toEqual(first);
  });

  it("keeps distinct review generations separate even when their prose is similar", () => {
    const first = normalizeFinalGateEvidence(
      source(1, "Codex Review: Didn't find any major issues. Finding deadbee. Reviewed commit: aaaaaaa", 7001),
      head,
    );
    const second = normalizeFinalGateEvidence(
      source(2, "Codex Review: Didn't find any major issues. Finding cafebabe. Reviewed commit: aaaaaaa", 7002),
      head,
    );
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
    const first = normalizeFinalGateEvidence({ ...base, review_commit: "a".repeat(40), review_generation_id: 7101 });
    const second = normalizeFinalGateEvidence({ ...base, review_commit: "b".repeat(40), review_generation_id: 7101 });
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("classifies CodeRabbit clean and provider outage evidence separately", () => {
    const clean = normalizeFinalGateEvidence(
      { ...source(), actor: "coderabbitai[bot]", body: "Final exact-head review is complete for aaaaaaa. I found no issues.", review_generation_id: 7201 },
      head,
    );
    const outage = normalizeFinalGateEvidence({ ...source(), actor: "coderabbitai[bot]", body: "Review rate limited. Try again later." });
    const skipped = normalizeFinalGateEvidence({ ...source(), actor: "coderabbitai[bot]", body: "Review skipped because automated reviews are unavailable." });
    expect(clean.signals[0].code).toBe("coderabbit_review_completed");
    expect(outage).toMatchObject({ category: "provider_unavailable", provider_class: "rate_limited" });
    expect(skipped).toMatchObject({ category: "provider_unavailable", provider_class: "unavailable" });
  });

  it("canonicalizes CodeRabbit invocation provenance without erasing the reviewed head", () => {
    const body = (digestValue: string, reviewedHead: string) =>
      `<!-- CodeRabbit review command invocation: v2:${digestValue} -->
Final exact-head review is complete for ${reviewedHead}. I found no issues.`;
    const first = normalizeFinalGateEvidence(
      { ...source(1), actor: "coderabbitai[bot]", body: body("1".repeat(64), head), review_generation_id: 7301 },
      head,
    );
    const duplicate = normalizeFinalGateEvidence(
      { ...source(2), actor: "coderabbitai[bot]", body: body("2".repeat(64), head), review_generation_id: 7301 },
      head,
    );
    const newerHeadValue = "b".repeat(40);
    const newerHead = normalizeFinalGateEvidence(
      { ...source(3), actor: "coderabbitai[bot]", body: body("3".repeat(64), newerHeadValue), review_generation_id: 7301 },
      newerHeadValue,
    );
    expect(duplicate).toEqual(first);
    expect(newerHead.signals[0].detail_digest).not.toBe(first.signals[0].detail_digest);
  });

  it("deduplicates one provider review generation across review and comment transports", () => {
    const codeRabbitReview = normalizeFinalGateEvidence({
      ...source(701),
      kind: "pull_request_review",
      actor: "coderabbitai[bot]",
      body: "Review completed.",
      review_state: "commented",
      review_commit: head,
      review_generation_id: 701,
    }, head);
    const codeRabbitSummary = normalizeFinalGateEvidence({
      ...source(702, `<!-- recent_review_start -->\nNo actionable comments were generated.\n${head}\n<!-- recent_review_end -->`),
      actor: "coderabbitai[bot]",
      review_generation_id: 701,
    }, head);
    expect(codeRabbitSummary).toEqual(codeRabbitReview);

    const codexReview = normalizeFinalGateEvidence({
      ...source(801),
      kind: "pull_request_review",
      actor: "chatgpt-codex-connector[bot]",
      body: "Codex review completed.",
      review_state: "commented",
      review_commit: head,
      review_generation_id: 801,
    }, head);
    const codexComment = normalizeFinalGateEvidence({
      ...source(802, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa"),
      review_generation_id: 801,
    }, head);
    expect(codexComment).toEqual(codexReview);
  });

  it("keeps distinct review generations materially distinct on the same head", () => {
    const first = normalizeFinalGateEvidence({
      ...source(901, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa"),
      review_generation_id: 9001,
    }, head);
    const second = normalizeFinalGateEvidence({
      ...source(902, "Codex Review: Didn't find any major issues. Reviewed commit: aaaaaaa"),
      review_generation_id: 9002,
    }, head);
    expect(first.signals[0].detail_digest).not.toBe(second.signals[0].detail_digest);
  });

  it("binds provider outage evidence to the exact target head", () => {
    const outage = { ...source(), actor: "coderabbitai[bot]", body: "Review rate limited. Try again later." };
    const first = normalizeFinalGateEvidence(outage, "a".repeat(40));
    const duplicate = normalizeFinalGateEvidence({ ...outage, id: 9002 }, "a".repeat(40));
    const newerHead = normalizeFinalGateEvidence({ ...outage, id: 9003 }, "b".repeat(40));
    expect(duplicate).toEqual(first);
    expect(newerHead.signals[0].detail_digest).not.toBe(first.signals[0].detail_digest);
  });

  it("defers review-completion comments that are not bound to a review generation", () => {
    expect(() => normalizeFinalGateEvidence({
      ...source(),
      actor: "chatgpt-codex-connector[bot]",
      review_generation_id: null,
    }, head)).toThrow("review_generation_required");
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
    const fresh = prepare([bot(first.persistence.body)], source(9999, "Codex Review: Didn't find any major issues. Reviewed commit: bbbbbbb", 7002), recovery());
    expect(fresh.decision).toBe("ALLOW_RERUN");
    expect(fresh.intent_id).not.toBe(first.intent_id);
  });

  it("material review change creates an independent intent", () => {
    const first = prepare();
    const changed = prepare([bot(first.persistence.body)], source(9999, "Codex Review: Didn't find any major issues. Semantic repair B. Reviewed commit: aaaaaaa", 7002), recovery());
    expect(changed.decision).toBe("ALLOW_RERUN");
    expect(changed.intent_id).not.toBe(first.intent_id);
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
        source(9100 + i, "Codex Review: Didn't find any major issues. Semantic generation " + i + ". Reviewed commit: " + String(i + 1).repeat(7), 8000 + i),
        recovery(),
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

    for (const intentId of ids) {
      const recovered = recoverAcceptedFinalGateIntent({
        ...baseInput(comments),
        intent_id: intentId,
        recovery_evidence: recovery(2),
      });
      expect(recovered.decision).toBe("RECOVERED_CONSUMED");
      if (recovered.persistence) comments = [bot(recovered.persistence.body)];
    }

    expect(listFinalGateRetryIntents(baseInput(comments)).filter((intent: {state: string}) => intent.state === "ACCEPTED")).toHaveLength(0);
    const fifth = prepare(
      comments,
      source(9200, "Codex Review: Didn't find any major issues. Semantic generation five. Reviewed commit: 5555555", 9005),
      recovery(),
    );
    expect(fifth.decision).toBe("ALLOW_RERUN");
  });

  it("keeps event provenance outside material evidence", () => {
    expect(hash(JSON.stringify(normalizeFinalGateEvidence(source(1))))).toBe(hash(JSON.stringify(normalizeFinalGateEvidence(source(2)))));
  });
});
