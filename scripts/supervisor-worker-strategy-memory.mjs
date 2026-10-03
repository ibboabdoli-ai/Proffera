import { createHash } from "node:crypto";
import { fingerprintEvidence, fingerprintStrategy } from "./supervisor-failure-memory.mjs";

const EXPECTED_REPOSITORY = "ibboabdoli-ai/Proffera";
const WORKER_OUTCOMES = new Set(["failed", "no_change", "cancelled", "succeeded"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function sortedPaths(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error("worker_strategy:" + field);
  }
  return [...new Set(value)].sort();
}
function materialTask(packet) {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)
    || typeof packet.task_goal !== "string" || !packet.task_goal
    || typeof packet.graph_path !== "string" || !packet.graph_path
    || !Number.isInteger(packet.risk_class) || packet.risk_class < 1 || packet.risk_class > 4) {
    throw new Error("worker_strategy:packet");
  }
  return {
    task_goal: packet.task_goal,
    graph_path: packet.graph_path,
    allowed_paths: sortedPaths(packet.allowed_paths, "allowed_paths"),
    forbidden_paths: sortedPaths(packet.forbidden_paths, "forbidden_paths"),
    risk_class: packet.risk_class,
  };
}

export function workerStrategyDescriptor(packet) {
  const material = materialTask(packet);
  const evidence = {
    lane: "worker",
    category: "unknown",
    signals: [{
      code: "worker_implementation_attempt",
      path: null,
      test_id: null,
      detail_digest: digest({ version: 1, material }),
    }],
    provider_class: null,
    stale_heads: null,
  };
  const strategy = {
    kind: "retry_codex_implementation",
    hypothesis_id: "worker_task_root_cause",
    variant_id: "codex_high",
  };
  return {
    evidence,
    strategy,
    evidence_fingerprint: fingerprintEvidence(evidence),
    strategy_fingerprint: fingerprintStrategy(strategy),
  };
}

function normalizeSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("worker_strategy:source");
  if (source.mode === "planner" && source.actor === "github-actions[bot]") return { kind: "planner" };
  if (source.mode === "comment" && source.actor === "ibboabdoli-ai") return { kind: "human" };
  throw new Error("worker_strategy:untrusted_source");
}

export function decideWorkerStrategyHistory({ packet, source, records }) {
  if (!Array.isArray(records)) throw new Error("worker_strategy:records");
  const actor = normalizeSource(source);
  const descriptor = workerStrategyDescriptor(packet);
  const prior = records.filter((record) => record
    && record.action_id === "worker_codex_attempt"
    && WORKER_OUTCOMES.has(record.outcome)
    && record.evidence_fingerprint === descriptor.evidence_fingerprint
    && record.strategy_fingerprint === descriptor.strategy_fingerprint);
  if (prior.length === 0) {
    return {
      decision: "ALLOW",
      reason: "No matching durable Worker strategy attempt exists.",
      evidence_fingerprint: descriptor.evidence_fingerprint,
      strategy_fingerprint: descriptor.strategy_fingerprint,
      prior_attempts: 0,
    };
  }
  if (actor.kind === "human") {
    return {
      decision: "ALLOW_HUMAN_REENTRY",
      reason: "Trusted owner evidence explicitly re-enters an unchanged Worker strategy.",
      evidence_fingerprint: descriptor.evidence_fingerprint,
      strategy_fingerprint: descriptor.strategy_fingerprint,
      prior_attempts: prior.length,
    };
  }
  return {
    decision: "SUPPRESS_REPEAT",
    reason: "Matching Worker failure/strategy history exists with no material re-entry evidence; automatic repeat suppressed.",
    evidence_fingerprint: descriptor.evidence_fingerprint,
    strategy_fingerprint: descriptor.strategy_fingerprint,
    prior_attempts: prior.length,
  };
}

export function workerStrategyObservation({ packet, repository, outcome, run_id, run_attempt, observed_at }) {
  if (repository !== EXPECTED_REPOSITORY) throw new Error("worker_strategy:repository");
  if (!WORKER_OUTCOMES.has(outcome)) throw new Error("worker_strategy:outcome");
  if (!Number.isSafeInteger(Number(run_id)) || Number(run_id) <= 0
    || !Number.isSafeInteger(Number(run_attempt)) || Number(run_attempt) <= 0) {
    throw new Error("worker_strategy:run");
  }
  const descriptor = workerStrategyDescriptor(packet);
  const failed = outcome !== "succeeded";
  return {
    repository,
    task_id: packet.task_id,
    pr_number: null,
    evidence: descriptor.evidence,
    strategy: descriptor.strategy,
    action_id: "worker_codex_attempt",
    outcome,
    outcome_basis: "strategy_result",
    stop: {
      kind: failed ? "same_evidence_strategy_failed" : "none",
      reference_digest: descriptor.evidence_fingerprint,
    },
    reentry: {
      kind: "human_evidence",
      reference_digest: descriptor.evidence_fingerprint,
    },
    head: packet.base_sha,
    observed_at,
    source: {
      kind: "actions",
      run_id: Number(run_id),
      attempt: Number(run_attempt),
      job_id: null,
    },
  };
}
