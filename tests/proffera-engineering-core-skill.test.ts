import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone pure Node .mjs follows the existing control-plane test convention.
import { normalizeDecision } from "../scripts/supervisor-decision-router.mjs";

const skill = () => readFileSync(
  resolve(process.cwd(), ".codex/skills/proffera-engineering-core/SKILL.md"),
  "utf8",
);

describe("Proffera Engineering Core skill", () => {
  it("declares the canonical skill identity and authority order", () => {
    const source = skill();

    expect(source).toContain("name: proffera-engineering-core");
    expect(source).toContain("`AGENTS.md`");
    expect(source).toContain("`WORKER_BOOTSTRAP.md`");
    expect(source).toContain("Supervisor issue `#548`");
    expect(source).toContain("If this skill conflicts with any source above, the source above wins.");
  });

  it("orchestrates existing deterministic contracts instead of duplicating them", () => {
    const source = skill();

    expect(source).toContain("`scripts/supervisor-decision-router.mjs`");
    expect(source).toContain("`scripts/supervisor-failure-memory.mjs`");
    expect(source).toContain("`scripts/supervisor-metrics.mjs`");
    expect(source).toContain("`.codex/skills/graphify/SKILL.md`");
    expect(source).toContain("Do not create a second repair engine, planner, Final Gate, review policy, or model router.");
  });

  it("keeps protected work and exact-head delivery fail closed", () => {
    const source = skill();

    expect(source).toContain("`requires_human_authorization=true`");
    expect(source).toContain("`control_plane`");
    expect(source).toContain("Production-mutation");
    expect(source).toContain("Ambiguous retry state fails closed.");
    expect(source).toContain("do not merge without the repository's required exact-head human authorization");
  });

  it("keeps the documented decision example valid against the real normalizer", () => {
    const source = skill();
    const match = source.match(/```json\n([\s\S]*?)\n```/);

    expect(match).not.toBeNull();
    const normalized = normalizeDecision(JSON.parse(match?.[1] ?? "{}"));
    expect(normalized.schema_version).toBe(1);
    expect(normalized.route_id).toBe("worker");
    expect(normalized.autonomous_dispatch_allowed).toBe(true);
  });

  it("uses only the existing router execution lanes", () => {
    const source = skill();

    for (const route of ["`worker`", "`review_repair`", "`ci_autofix`"]) {
      expect(source).toContain(route);
    }
    expect(source).not.toContain("auto_merge_allowed=true");
    expect(source).not.toContain("production_mutation_allowed=true");
  });
});
