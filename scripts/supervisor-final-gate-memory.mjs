#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  createMemory,
  decideRetryRecovery,
  memoryIdentity,
  prepareRetryIntent,
  readTrustedMemory,
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
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/(Reviewed commit:\s*\*{0,2}\s*\x60?)[0-9a-f]{7,40}(\x60?)/gi, "$1<sha>$2")
    .replace(/(proffera-(?:coderabbit-final-review-request|codex-fallback-review-request):)[0-9a-f]{40}/gi, "$1<sha>")
    .replace(/\b[0-9a-f]{40}\b/gi, "<sha>")
    .replace(/\b\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z\b/g, "<time>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeFinalGateEvidence(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("final_gate_memory:source");
  const { kind, actor, body = "", review_state = "" } = source;
  let code = "";
  let category = "review_blocked";
  let providerClass = null;

  if (kind === "issue_comment" && actor === "coderabbitai[bot]") {
    if (/Final exact-head review is complete for/i.test(body) && /I found no issues\./i.test(body)) {
      code = "coderabbit_clean";
    } else if (/Review limit reached|Review rate[ -]?limited|rate[ -]?limit/i.test(body)) {
      code = "provider_unavailable";
      category = "provider_unavailable";
      providerClass = "rate_limited";
    } else if (/temporarily unavailable|service unavailable|Action not completed/i.test(body)) {
      code = "provider_unavailable";
      category = "provider_unavailable";
      providerClass = "unavailable";
    } else if (body.includes("<!-- recent_review_start -->")) {
      code = "coderabbit_review_summary";
    }
  } else if (kind === "issue_comment" && actor === "chatgpt-codex-connector[bot]") {
    if (body.startsWith("Codex Review: Didn't find any major issues.")) code = "codex_clean";
  } else if (kind === "issue_comment" && actor === OWNER) {
    if (/proffera-codex-fallback-review-request:[0-9a-f]{40}/i.test(body) && /@codex\s+review/i.test(body)) {
      code = "codex_fallback_requested";
    }
  } else if (kind === "pull_request_review" && ["coderabbitai[bot]", "chatgpt-codex-connector[bot]"].includes(actor)) {
    if (String(review_state).toLowerCase() === "changes_requested") code = "review_changes_requested";
    else if (["commented", "approved"].includes(String(review_state).toLowerCase())) {
      code = actor === "coderabbitai[bot]" ? "coderabbit_review_completed" : "codex_review_completed";
    }
  }

  if (!code) throw new Error("final_gate_memory:unsupported_evidence");
  const normalized = materialText(code === "provider_unavailable" ? code + ":" + providerClass : body || code);
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
  const evidence = normalizeFinalGateEvidence(input.source);
  const prepared = prepareRetryIntent(current, memoryIdentity(current), {
    repository: input.repository,
    pr_number: Number(input.pr_number),
    evidence,
    strategy: STRATEGY,
    target: input.target,
    source: retrySource(input.source),
    prepared_at: input.prepared_at,
  });

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
    identity: finalGateMemoryIdentity,
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