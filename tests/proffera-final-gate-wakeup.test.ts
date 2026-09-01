import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("event-driven final review gate", () => {
  it("keeps the required final gate exact-head and wakes only that job after review evidence changes", () => {
    const ci = source(".github/workflows/ci.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");

    expect(ci).toContain("name: E2E public smoke");
    expect(ci).toContain("No completed CodeRabbit review for current head yet; high-risk path remains CodeRabbit-only while waiting for a review or provider signal.");
    expect(ci).toContain("CodeRabbit high-risk availability timeout reached; exact-head Codex fallback will be allowed on the next poll.");
    expect(ci).toContain('echo "CodeRabbit changes remain requested for current head; Codex fallback cannot clear them."\n              exit 1');

    expect(wakeup).toContain("pull_request_review:");
    expect(wakeup).toContain("issue_comment:");
    expect(wakeup).toContain("workflow_dispatch:");
    expect(wakeup).toContain("github.actor == 'coderabbitai[bot]'");
    expect(wakeup).toContain("github.actor == 'chatgpt-codex-connector[bot]'");
    expect(wakeup).toContain("EVENT_REVIEW_COMMIT");
    expect(wakeup).toContain('EVENT_REVIEW_COMMIT" != "$head_sha');
    expect(wakeup).toContain('select(.head_sha == $sha)');
    expect(wakeup).toContain("jobs?filter=all&per_page=100");
    expect(wakeup).toContain("sort_by(.run_attempt // 0, .id)");
    expect(wakeup).toContain('require_success "Validate"');
    expect(wakeup).toContain('require_success "AI review route"');
    expect(wakeup).toContain('require_success "E2E public smoke run"');
    expect(wakeup).toContain('select(.name == "E2E public smoke")');
    expect(wakeup).toContain('actions/jobs/$final_job_id/rerun');
    expect(wakeup).toContain("Heavy CI jobs were not re-run.");
    expect(wakeup).not.toContain("sleep ");
    expect(wakeup).not.toContain("seq 1");
  });

  it("keeps high-risk CodeRabbit-primary while allowing bounded exact-head fallback after provider failure", () => {
    const ci = source(".github/workflows/ci.yml");

    expect(ci).toContain("fallback_eligible=true");
    expect(ci).toContain("fallback_eligible=false");
    expect(ci).toContain("CodeRabbit availability timeout reached; Codex fallback is allowed for this medium-risk PR.");
    expect(ci).toContain("No completed CodeRabbit review for current head yet; high-risk path remains CodeRabbit-only while waiting for a review or provider signal.");
    expect(ci).toContain("Machine-observed CodeRabbit availability failure; emergency exact-head Codex fallback is allowed for this high-risk PR.");
    expect(ci).toContain("CodeRabbit high-risk availability timeout reached; exact-head Codex fallback will be allowed on the next poll.");
    expect(ci).toContain("CodeRabbit changes remain requested for current head; Codex fallback cannot clear them.");
    expect(ci).toContain("CodeRabbit changes were recorded while Codex fallback was running; Codex cannot clear them.");
  });
});
