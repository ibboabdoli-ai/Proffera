import { createHash } from "node:crypto";

/**
 * Phase B2 deterministic decision artifact and capability routing contract.
 *
 * Pure only: no I/O, workflow imports, provider/model calls, GitHub writes,
 * Production mutation, dispatch, retry, merge, or authorization side effects.
 * Live adapters may consume this only after authenticating their own evidence.
 */
export const DECISION_SCHEMA_VERSION = 1;
export const CODEX_ACTION_REVISION = "86365089eb2b84e0a8fb0717b304f8bdcb13b20e";
export const ACTION_DEFAULT_MODEL = "action-default";

export const TASK_TYPES = Object.freeze([
  "analysis",
  "bugfix",
  "feature",
  "test",
  "documentation",
  "control_plane",
  "migration",
  "production_operation",
]);

export const REASONING_DIFFICULTIES = Object.freeze([
  "routine",
  "moderate",
  "complex",
  "deep",
]);

export const CAPABILITIES = Object.freeze([
  "architecture_analysis",
  "repository_write",
  "test_execution",
  "review_repair",
  "ci_repair",
  "workflow_write",
  "security_sensitive",
  "database_schema",
  "production_mutation",
  "external_side_effect",
]);

export const ROUTES = Object.freeze({
  planner: Object.freeze({
    action_revision: CODEX_ACTION_REVISION,
    model: ACTION_DEFAULT_MODEL,
    effort: "high",
    purpose: "bounded_task_selection",
  }),
  worker: Object.freeze({
    action_revision: CODEX_ACTION_REVISION,
    model: ACTION_DEFAULT_MODEL,
    effort: "high",
    purpose: "bounded_implementation",
  }),
  review_repair: Object.freeze({
    action_revision: CODEX_ACTION_REVISION,
    model: ACTION_DEFAULT_MODEL,
    effort: "high",
    purpose: "batched_exact_head_review_repair",
  }),
  ci_autofix: Object.freeze({
    action_revision: CODEX_ACTION_REVISION,
    model: ACTION_DEFAULT_MODEL,
    effort: "high",
    purpose: "bounded_ci_repair",
  }),
});

const PROTECTED_CAPABILITIES = new Set([
  "workflow_write",
  "security_sensitive",
  "database_schema",
  "production_mutation",
  "external_side_effect",
]);

const RISK_FLOORS = Object.freeze({
  workflow_write: 3,
  security_sensitive: 3,
  database_schema: 3,
  production_mutation: 4,
  external_side_effect: 4,
});

const isRecord = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

const canonical = (value) => JSON.stringify(value, (_key, item) =>
  isRecord(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);

const fail = (code) => {
  throw new Error("supervisor_decision:" + code);
};

function exactKeys(value, keys) {
  if (!isRecord(value)) fail("object_required");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("|") !== expected.join("|")) fail("fields");
}

function member(value, values, code) {
  if (!values.includes(value)) fail(code);
  return value;
}

function capabilities(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > CAPABILITIES.length) {
    fail("capabilities");
  }
  const normalized = value.map((item) => member(item, CAPABILITIES, "capability"));
  if (new Set(normalized).size !== normalized.length) fail("duplicate_capability");
  return normalized.sort();
}

function minimumRisk(taskType, caps) {
  let floor = taskType === "migration" ? 3 : taskType === "production_operation" ? 4 : 1;
  for (const capability of caps) floor = Math.max(floor, RISK_FLOORS[capability] ?? 1);
  return floor;
}

function routeFor(caps) {
  if (caps.includes("review_repair") && caps.includes("ci_repair")) fail("ambiguous_repair_route");
  if (caps.includes("review_repair")) return "review_repair";
  if (caps.includes("ci_repair")) return "ci_autofix";
  return "worker";
}

export function normalizeDecision(input) {
  exactKeys(input, [
    "schema_version",
    "task_type",
    "risk_class",
    "reasoning_difficulty",
    "capabilities",
  ]);
  if (input.schema_version !== DECISION_SCHEMA_VERSION) fail("schema_version");
  const taskType = member(input.task_type, TASK_TYPES, "task_type");
  const difficulty = member(input.reasoning_difficulty, REASONING_DIFFICULTIES, "reasoning_difficulty");
  if (!Number.isInteger(input.risk_class) || input.risk_class < 1 || input.risk_class > 4) fail("risk_class");
  const caps = capabilities(input.capabilities);
  const floor = minimumRisk(taskType, caps);
  if (input.risk_class < floor) fail("risk_underclassified");

  const protectedCapability = caps.some((capability) => PROTECTED_CAPABILITIES.has(capability));
  const routeId = routeFor(caps);
  const route = ROUTES[routeId];
  const requiresHumanAuthorization = input.risk_class >= 3 || protectedCapability;

  return {
    schema_version: DECISION_SCHEMA_VERSION,
    task_type: taskType,
    risk_class: input.risk_class,
    reasoning_difficulty: difficulty,
    capabilities: caps,
    minimum_risk_class: floor,
    protected_capability: protectedCapability,
    autonomous_dispatch_allowed: !requiresHumanAuthorization,
    requires_human_authorization: requiresHumanAuthorization,
    route_id: routeId,
    route,
  };
}

export function decisionFingerprint(input) {
  const normalized = normalizeDecision(input);
  return createHash("sha256")
    .update(canonical({ version: DECISION_SCHEMA_VERSION, decision: normalized }))
    .digest("hex");
}

export function routeForDecision(input) {
  const normalized = normalizeDecision(input);
  return {
    route_id: normalized.route_id,
    action_revision: normalized.route.action_revision,
    model: normalized.route.model,
    effort: normalized.route.effort,
    autonomous_dispatch_allowed: normalized.autonomous_dispatch_allowed,
    requires_human_authorization: normalized.requires_human_authorization,
  };
}
