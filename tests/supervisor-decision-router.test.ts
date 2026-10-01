import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone pure Node .mjs follows the existing control-plane test convention.
import { ACTION_DEFAULT_MODEL, CAPABILITIES, CODEX_ACTION_REVISION, DECISION_SCHEMA_VERSION, REASONING_DIFFICULTIES, ROUTES, TASK_TYPES, decisionFingerprint, normalizeDecision, routeForDecision } from "../scripts/supervisor-decision-router.mjs";

const decision = (overrides: Record<string, unknown> = {}) => ({
  schema_version: 1,
  task_type: "bugfix",
  risk_class: 2,
  reasoning_difficulty: "complex",
  capabilities: ["repository_write", "test_execution"],
  ...overrides,
});

describe("Supervisor Phase B2 decision router", () => {
  it("keeps a closed, explicit decision vocabulary", () => {
    expect(DECISION_SCHEMA_VERSION).toBe(1);
    expect(TASK_TYPES).toEqual([
      "analysis",
      "bugfix",
      "feature",
      "test",
      "documentation",
      "control_plane",
      "migration",
      "production_operation",
    ]);
    expect(REASONING_DIFFICULTIES).toEqual(["routine", "moderate", "complex", "deep"]);
    expect(CAPABILITIES).toContain("workflow_write");
    expect(CAPABILITIES).toContain("production_mutation");
  });

  it("normalizes capability order and returns one deterministic worker route", () => {
    const normalized = normalizeDecision(decision({
      capabilities: ["test_execution", "repository_write"],
    }));

    expect(normalized.capabilities).toEqual(["repository_write", "test_execution"]);
    expect(normalized.route_id).toBe("worker");
    expect(normalized.autonomous_dispatch_allowed).toBe(true);
    expect(normalized.requires_human_authorization).toBe(false);
    expect(normalized.minimum_risk_class).toBe(1);
  });

  it("routes review and CI repair through distinct existing executor roles", () => {
    expect(routeForDecision(decision({
      capabilities: ["review_repair", "repository_write", "test_execution"],
    })).route_id).toBe("review_repair");

    expect(routeForDecision(decision({
      capabilities: ["ci_repair", "repository_write", "test_execution"],
    })).route_id).toBe("ci_autofix");

    expect(() => normalizeDecision(decision({
      capabilities: ["review_repair", "ci_repair"],
    }))).toThrow("supervisor_decision:ambiguous_repair_route");
  });

  it.each([
    ["workflow_write", 3],
    ["security_sensitive", 3],
    ["database_schema", 3],
    ["production_mutation", 4],
    ["external_side_effect", 4],
  ] as const)("fails closed when %s is classified below risk %i", (capability, minimum) => {
    expect(() => normalizeDecision(decision({
      risk_class: minimum - 1,
      capabilities: [capability],
    }))).toThrow("supervisor_decision:risk_underclassified");

    const normalized = normalizeDecision(decision({
      risk_class: minimum,
      capabilities: [capability],
    }));
    expect(normalized.minimum_risk_class).toBe(minimum);
    expect(normalized.protected_capability).toBe(true);
    expect(normalized.autonomous_dispatch_allowed).toBe(false);
    expect(normalized.requires_human_authorization).toBe(true);
  });

  it("requires human authorization for risk class 3/4 even without protected capabilities", () => {
    for (const risk_class of [3, 4]) {
      const normalized = normalizeDecision(decision({ risk_class }));
      expect(normalized.autonomous_dispatch_allowed).toBe(false);
      expect(normalized.requires_human_authorization).toBe(true);
    }
  });

  it("enforces task-type risk floors for migration and Production operations", () => {
    expect(() => normalizeDecision(decision({
      task_type: "migration",
      risk_class: 2,
      capabilities: ["repository_write"],
    }))).toThrow("supervisor_decision:risk_underclassified");

    expect(() => normalizeDecision(decision({
      task_type: "production_operation",
      risk_class: 3,
      capabilities: ["architecture_analysis"],
    }))).toThrow("supervisor_decision:risk_underclassified");
  });

  it("rejects unknown fields, duplicate capabilities, and unsupported vocabulary", () => {
    expect(() => normalizeDecision({ ...decision(), extra: true })).toThrow("supervisor_decision:fields");
    expect(() => normalizeDecision(decision({
      capabilities: ["repository_write", "repository_write"],
    }))).toThrow("supervisor_decision:duplicate_capability");
    expect(() => normalizeDecision(decision({ task_type: "magic" }))).toThrow("supervisor_decision:task_type");
    expect(() => normalizeDecision(decision({ reasoning_difficulty: "xhigh" })))
      .toThrow("supervisor_decision:reasoning_difficulty");
  });

  it("fingerprints material decision changes but not caller capability ordering", () => {
    const first = decisionFingerprint(decision({
      capabilities: ["repository_write", "test_execution"],
    }));
    const reordered = decisionFingerprint(decision({
      capabilities: ["test_execution", "repository_write"],
    }));
    const harder = decisionFingerprint(decision({
      reasoning_difficulty: "deep",
    }));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
    expect(harder).not.toBe(first);
  });

  it("centralizes the currently supported Codex action revision and truthful model semantics", () => {
    expect(ACTION_DEFAULT_MODEL).toBe("action-default");
    for (const route of Object.values(ROUTES) as Array<Record<string, string>>) {
      expect(route.action_revision).toBe(CODEX_ACTION_REVISION);
      expect(route.effort).toBe("high");
      expect(route.model).toBe("action-default");
    }

    for (const workflow of [
      ".github/workflows/supervisor-planner.yml",
      ".github/workflows/supervisor-worker-handoff.yml",
      ".github/workflows/supervisor-review-repair.yml",
      ".github/workflows/proffera-ci-autofix.yml",
    ]) {
      const source = readFileSync(resolve(process.cwd(), workflow), "utf8");
      expect(source).toContain(`openai/codex-action@${CODEX_ACTION_REVISION}`);
      expect(source).toContain("effort: high");
      expect(source).not.toMatch(/^\s*model:\s*/m);
    }
  });
});
