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
    expect(wakeup).toContain("github.actor == 'ibboabdoli-ai'");
    expect(wakeup).toContain("proffera-codex-fallback-review-request:");
    expect(wakeup).toContain("@codex review");
    expect(wakeup).toContain("TRUSTED_CODEX_REQUESTER: ibboabdoli-ai");
    expect(wakeup).toContain('codex_marker="<!-- proffera-codex-fallback-review-request:${head_sha} -->"');
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

  it("accepts only fresh exact-head official Codex clean comments with a prior trusted request", () => {
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");

    expect(wakeup).toContain("EVENT_COMMENT_CREATED_AT");
    expect(wakeup).toContain('EVENT_ACTOR:-}" = "chatgpt-codex-connector[bot]"');
    expect(wakeup).toContain("Codex Review: Didn\\u0027t find any major issues.");
    expect(wakeup).toContain("Reviewed commit:");
    expect(wakeup).toContain("[0-9a-fA-F]{7,40}");
    expect(wakeup).toContain('[[ "$head_sha" != "$reviewed_prefix"* ]]');
    expect(wakeup).toContain('coderabbit_marker="<!-- proffera-coderabbit-final-review-request:${head_sha} -->"');
    expect(wakeup).toContain('select(.user.login == "github-actions[bot]")');
    expect(wakeup).toContain('select(.user.login == $requester)');
    expect(wakeup).toContain('contains("@codex review")');
    expect(wakeup).toContain(".created_at >= $primary_time and .created_at <= $result_time");
    expect(wakeup).toContain("No trusted exact-head Codex request exists after the primary CodeRabbit request and before this result");
    expect(wakeup).toContain("Codex clean comment does not reference the exact current head");
  });

  it("keeps high-risk CodeRabbit-primary while allowing bounded exact-head fallback after provider failure", () => {
    const ci = source(".github/workflows/ci.yml");

    expect(ci).toContain("fallback_eligible=true");
    expect(ci).toContain("fallback_eligible=false");
    expect(ci).toContain("CodeRabbit availability timeout reached; Codex fallback is allowed for this medium-risk PR.");
    expect(ci).toContain("No completed CodeRabbit review for current head yet; high-risk path remains CodeRabbit-only while waiting for a review or provider signal.");
    expect(ci).toContain("Machine-observed CodeRabbit availability failure; emergency exact-head Codex fallback is allowed for this high-risk PR.");
    expect(ci).toContain("CodeRabbit high-risk availability timeout reached; exact-head Codex fallback will be allowed on the next poll.");
    expect(ci).toContain("Trusted Codex fallback requires an exact-head @codex review request from $trusted_codex_requester; GitHub Actions will not self-request Codex review.");
    expect(ci).toContain("CodeRabbit changes remain requested for current head; Codex fallback cannot clear them.");
    expect(ci).toContain("CodeRabbit changes were recorded while Codex fallback was running; Codex cannot clear them.");
  });
});
