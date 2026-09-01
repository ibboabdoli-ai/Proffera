import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

describe("high-risk AI review outage fallback", () => {
  it("allows exact-head Codex fallback after an explicit CodeRabbit outage or a bounded provider timeout", () => {
    const unavailableCount = workflow.indexOf("high_risk_unavailable_count");
    expect(unavailableCount).toBeGreaterThan(-1);

    const emergencyStart = workflow.lastIndexOf(
      'if [ "$fallback_eligible" != "true" ]; then',
      unavailableCount,
    );
    expect(emergencyStart).toBeGreaterThan(-1);

    const normalFallbackStart = workflow.indexOf(
      'if [ "$fallback_eligible" = "true" ]; then',
      unavailableCount,
    );
    expect(normalFallbackStart).toBeGreaterThan(unavailableCount);

    const emergencyBlock = workflow.slice(emergencyStart, normalFallbackStart);
    expect(emergencyBlock).toContain("high_risk_unavailable_count");
    expect(emergencyBlock).toContain("Review limit reached");
    expect(emergencyBlock).toContain("Review rate limited");
    expect(emergencyBlock).toContain("temporarily unavailable");
    expect(emergencyBlock).toContain("service unavailable");
    expect(emergencyBlock).toContain(
      "emergency exact-head Codex fallback is allowed for this high-risk PR",
    );

    expect(workflow).toContain('if [ "$attempt" -ge 20 ]; then');
    expect(workflow).toContain(
      "CodeRabbit high-risk availability timeout reached; exact-head Codex fallback will be allowed on the next poll.",
    );
    expect(workflow).toContain(
      "Requested Codex fallback review for exact head $HEAD_SHA.",
    );
    expect(workflow).toContain(
      "Refused: Codex fallback became stale; current PR head is $guard_head_sha, gate head is $HEAD_SHA.",
    );
  });

  it("keeps current-head CodeRabbit change requests non-bypassable", () => {
    expect(workflow).toContain(
      "CodeRabbit changes remain requested for current head; Codex fallback cannot clear them.",
    );
    expect(workflow).toContain(
      "CodeRabbit changes were recorded while Codex fallback was running; Codex cannot clear them.",
    );
    expect(workflow).toContain(
      "No completed CodeRabbit review for current head yet; high-risk path remains CodeRabbit-only while waiting for a review or provider signal.",
    );
  });
});
