import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  decideRetryRecovery,
  memoryIdentity,
  prepareRetryIntent,
  readTrustedMemory,
  releasePreparedRetryIntent,
  serializeMemory,
  transitionRetryIntent,
  upgradeMemory,
} from "./supervisor-failure-memory.mjs";

const OWNER = "ibboabdoli-ai";
const STRATEGY = Object.freeze({
  kind: "rerun_final_gate",
  hypothesis_id: "new_review_evidence",
  variant_id: "final_gate_memory_v1",
});

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");

function materialText(value) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/<!--\s*CodeRabbit review command invocation:\s*v2:[0-9a-f]{64}\s*-->/gi, "<coderabbit-invocation>")
    .replace(/\s+/g, " ")
    .trim();
}

// Availability is a provider statement, not a generic skipped/disabled status.
// The live adapter separately authenticates its actor and post-request freshness.
export function providerUnavailable(body) {
  if (/automatic reviews? (?:are |is )?disabled|auto(?:matic)?[ _-]?review[^\n]*disabled/i.test(body)) return null;
  if (/Review limit reached|Review rate limited/i.test(body)) return "rate_limited";
  if (/temporarily unavailable|service unavailable/i.test(body)) return "unavailable";
  return null;
}

export function cleanCodeRabbitComment(body, head) {
  if (!/^[0-9a-f]{40}$/.test(head) || /Review limit reached|Review rate[ -]?limited|rate[ -]?limit|Action not completed|Review skipped|temporarily unavailable|service unavailable|incomplete|did not complete/i.test(body)) return false;
  const lines = String(body).split(/\r?\n/).map((line) => line.trim());
  const sentence = (prefix) => lines.some((line) => new RegExp(`^(?:@[A-Za-z0-9-]+\\s+)?${prefix}\\s+\x60?${head}\x60?\\.$`).test(line));
  return (lines.some((line) => /^<!-- CodeRabbit review command invocation: v2:[0-9a-f]{64} -->$/.test(line))
    && sentence("Final exact-head review is complete for") && lines.includes("I found no issues."))
    || (sentence("Review completed for exact HEAD") && lines.includes("I found no material findings."));
}

export function normalizeFinalGateEvidence(source, targetHead = source?.review_commit ?? "") {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("final_gate_memory:source");
  const { kind, actor, body = "", review_state = "" } = source;
  const normalizedTargetHead = targetHead === "" ? "" : String(targetHead).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalizedTargetHead)) throw new Error("final_gate_memory:target_head");
  let code = "";
  let category = "review_blocked";
  let providerClass = null;

  if (kind === "issue_comment" && actor === "coderabbitai[bot]") {
    if (cleanCodeRabbitComment(body, normalizedTargetHead)) {
      code = "coderabbit_review_completed";
    } else if (providerUnavailable(body)) {
      code = "provider_unavailable";
      category = "provider_unavailable";
      providerClass = providerUnavailable(body);
    } else if (body.includes("<!-- recent_review_start -->")) {
      code = "coderabbit_review_completed";
    }
  } else if (kind === "issue_comment" && actor === "chatgpt-codex-connector[bot]") {
    if (body.startsWith("Codex Review: Didn't find any major issues.")) {
      code = "codex_review_completed";
    }
  } else if (kind === "issue_comment" && actor === OWNER) {
    if (body.includes(`<!-- proffera-codex-fallback-review-request:${normalizedTargetHead} -->`) && body.includes("@codex review")) {
      code = "codex_fallback_requested";
    }
  } else if (kind === "pull_request_review" && ["coderabbitai[bot]", "chatgpt-codex-connector[bot]"].includes(actor)) {
    if (String(review_state).toLowerCase() === "changes_requested") code = "review_changes_requested";
    else if (["commented", "approved"].includes(String(review_state).toLowerCase())) {
      code = actor === "coderabbitai[bot]" ? "coderabbit_review_completed"
        : String(review_state).toLowerCase() === "approved" ? "codex_review_completed" : "codex_review_pending";
    }
  }

  if (!code) throw new Error("final_gate_memory:unsupported_evidence");
  const reviewedCommit = kind === "pull_request_review" ? String(source.review_commit ?? "") : "";
  if (kind === "pull_request_review" && reviewedCommit !== normalizedTargetHead) throw new Error("final_gate_memory:review_head");
  // The gate treats nonblocking reviews with no findings as the same clean decision.
  // IDs, generation guesses, prose wrappers and delivery order are provenance only.
  // Findings keep their actual location/content (including URLs and case); editing a
  // finding is material, while reposting it under another transport ID is not.
  const normalizeFindings = (items) => [...new Set(items.map((finding) => JSON.stringify({
    path: finding.path ?? null,
    line: finding.original_line ?? finding.line ?? null,
    side: finding.side ?? null,
    body: materialText(finding.body),
  })))].sort();
  const findings = normalizeFindings(source.findings ?? []);
  const clearedChanges = [...new Set((source.cleared_changes ?? []).map((change) => JSON.stringify({
    body: materialText(change.body), findings: normalizeFindings(change.findings ?? []),
  })))].sort();
  const normalized = JSON.stringify({
    code,
    head: normalizedTargetHead,
    detail: code === "codex_fallback_requested"
      ? `<!-- proffera-codex-fallback-review-request:${normalizedTargetHead} -->`
      : code === "provider_unavailable" ? providerClass
        : code === "review_changes_requested" ? materialText(body) : { findings, cleared_changes: clearedChanges },
  });
  return {
    lane: "final_gate",
    category,
    signals: [{ code, path: null, test_id: null, detail_digest: sha256(normalized) }],
    provider_class: providerClass,
    stale_heads: null,
  };
}

function retrySource(source) {
  return {
    kind: source.kind,
    id: Number(source.id),
    actor: source.actor,
    observed_at: source.observed_at,
    review_commit: source.kind === "pull_request_review" ? source.review_commit : null,
    body_digest: sha256(String(source.body ?? "") + "\n" + String(source.review_state ?? "")),
  };
}

function readMemory(input) {
  return readTrustedMemory(input.comments, {
    repository: input.repository,
    scope: { kind: "pull_request", pr_number: Number(input.pr_number) },
    complete: input.comments_complete === true,
  });
}

function persistence(snapshot) {
  return {
    comment_id: snapshot.comment_id,
    body: serializeMemory(snapshot.memory),
    identity: memoryIdentity(snapshot),
  };
}

export function ensureFinalGateMemory(input) {
  const current = readMemory(input);
  if (current.memory.schema_version === 2) return { action: "none", current_identity: memoryIdentity(current) };
  const next = upgradeMemory(current, memoryIdentity(current));
  return {
    action: current.comment_id === null ? "create" : "update",
    persistence: persistence(next),
  };
}

export function decideFinalGateRetry(input) {
  const current = readMemory(input);
  if (current.memory.schema_version !== 2) throw new Error("final_gate_memory:v2_required");
  const evidence = normalizeFinalGateEvidence(input.source, input.target?.head ?? "");
  let prepared = prepareRetryIntent(current, memoryIdentity(current), {
    repository: input.repository,
    pr_number: Number(input.pr_number),
    evidence,
    strategy: STRATEGY,
    target: input.target,
    source: retrySource(input.source),
    prepared_at: input.prepared_at,
  });

  if (prepared.created) {
    // D0 validates the complete candidate target; evidence identity alone does not
    // authorize another side effect on an unresolved execution boundary. Reuse
    // its original intent and recovery path without persisting a second record.
    const target = prepared.snapshot.memory.intents.find((item) => item.id === prepared.intent_id).target;
    const pending = current.memory.intents.find((item) => item.state !== "CONSUMED"
      && item.target.workflow_path === target.workflow_path
      && item.target.head === target.head && item.target.run_id === target.run_id
      && item.target.run_attempt === target.run_attempt
      && item.target.job.id === target.job.id && item.target.job.name === target.job.name);
    if (pending) prepared = {snapshot: current, intent_id: pending.id, created: false};
  }

  if (prepared.created) {
    return {
      decision: "ALLOW_RERUN",
      intent_id: prepared.intent_id,
      persistence: persistence(prepared.snapshot),
      binding_digest: prepared.snapshot.memory.intents.find((item) => item.id === prepared.intent_id)?.binding_digest ?? null,
      evidence,
    };
  }

  const intent = prepared.snapshot.memory.intents.find((item) => item.id === prepared.intent_id);
  if (!intent) throw new Error("final_gate_memory:intent_missing");
  if (intent.state === "CONSUMED") {
    return { decision: "SUPPRESS_DUPLICATE", intent_id: intent.id, state: intent.state, evidence };
  }

  if (!input.recovery_evidence) {
    return { decision: "FAIL_CLOSED_UNCERTAIN", intent_id: intent.id, state: intent.state, evidence };
  }

  const recovery = decideRetryRecovery(intent, input.recovery_evidence);
  if (recovery.decision === "REJECT_MISMATCH") {
    return { decision: "FAIL_CLOSED_MISMATCH", intent_id: intent.id, state: intent.state, evidence };
  }
  const next = transitionRetryIntent(prepared.snapshot, memoryIdentity(prepared.snapshot), intent.id, {
    kind: "recover",
    evidence: input.recovery_evidence,
  });
  return {
    decision: recovery.decision === "CONFIRM_CONSUMED" ? "RECOVERED_CONSUMED" : "FAIL_CLOSED_UNCERTAIN",
    intent_id: intent.id,
    state: next.memory.intents.find((item) => item.id === intent.id)?.state ?? null,
    persistence: persistence(next),
    evidence,
  };
}

export function listFinalGateRetryIntents(input) {
  const current = readMemory(input);
  if (current.memory.schema_version !== 2) throw new Error("final_gate_memory:v2_required");
  return current.memory.intents.map((intent) => ({
    id: intent.id,
    state: intent.state,
    target: intent.target,
    evidence_fingerprint: intent.evidence_fingerprint,
    strategy_fingerprint: intent.strategy_fingerprint,
  }));
}

export function recoverAcceptedFinalGateIntent(input) {
  const current = readMemory(input);
  if (current.memory.schema_version !== 2) throw new Error("final_gate_memory:v2_required");
  const intent = current.memory.intents.find((item) => item.id === input.intent_id);
  if (!intent) throw new Error("final_gate_memory:intent_missing");
  if (intent.state === "CONSUMED") return { decision: "RECOVERED_CONSUMED", persistence: null };
  if (!["ACCEPTED", "UNCERTAIN"].includes(intent.state) || !intent.acceptance) {
    return { decision: "KEEP_PENDING", persistence: null };
  }
  const recovery = decideRetryRecovery(intent, input.recovery_evidence);
  if (recovery.decision === "REJECT_MISMATCH") {
    return { decision: "FAIL_CLOSED_MISMATCH", persistence: null };
  }
  if (recovery.decision !== "CONFIRM_CONSUMED") {
    return { decision: "KEEP_PENDING", persistence: null };
  }
  const next = transitionRetryIntent(current, memoryIdentity(current), intent.id, {
    kind: "recover",
    evidence: input.recovery_evidence,
  });
  return { decision: "RECOVERED_CONSUMED", persistence: persistence(next) };
}

export function acceptFinalGateRetry(input) {
  const current = readMemory(input);
  const next = transitionRetryIntent(current, memoryIdentity(current), input.intent_id, {
    kind: "accepted",
    receipt: input.receipt,
  });
  return { decision: "ACCEPTED", persistence: persistence(next) };
}

export function markFinalGateUncertain(input) {
  const current = readMemory(input);
  const next = transitionRetryIntent(current, memoryIdentity(current), input.intent_id, {
    kind: "uncertain",
    reason: input.reason,
    observed_at: input.observed_at,
  });
  return { decision: "FAIL_CLOSED_UNCERTAIN", persistence: persistence(next) };
}

export function releaseFinalGatePreparedIntent(input) {
  const current = readMemory(input);
  const next = releasePreparedRetryIntent(current, memoryIdentity(current), input.intent_id);
  return { decision: "RELEASED_PRE_POST", persistence: persistence(next) };
}

export function finalGateMemoryIdentity(input) {
  const current = readMemory(input);
  return { identity: memoryIdentity(current), schema_version: current.memory.schema_version };
}

function main(argv) {
  if (argv.length !== 2) throw new Error("usage");
  const [command, file] = argv;
  const input = JSON.parse(readFileSync(file, "utf8"));
  const handlers = {
    ensure: ensureFinalGateMemory,
    decide: decideFinalGateRetry,
    accept: acceptFinalGateRetry,
    uncertain: markFinalGateUncertain,
    releasePrepared: releaseFinalGatePreparedIntent,
    identity: finalGateMemoryIdentity,
    intents: listFinalGateRetryIntents,
    recoverAccepted: recoverAcceptedFinalGateIntent,
  };
  if (!handlers[command]) throw new Error("command");
  process.stdout.write(JSON.stringify(handlers[command](input)));
}

if (process.argv[1]?.endsWith("supervisor-final-gate-memory.mjs")) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "final_gate_memory:error");
    process.exitCode = 1;
  }
}
