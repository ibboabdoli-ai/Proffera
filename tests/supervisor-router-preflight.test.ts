import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as {
  load: (text: string) => { jobs: { route: { if?: string; steps: unknown[] } } };
};
const source = readFileSync(resolve(".github/workflows/supervisor-event-router.yml"), "utf8");
const route = load(source).jobs.route;
const preflight = route.if ?? "";

describe("Supervisor router runner-cost preflight", () => {
  it("parses and retains the original single router job", () => {
    expect(route.steps).toHaveLength(1);
    expect(preflight).toContain("github.event_name == 'issue_comment'");
    expect(preflight).toContain("github.event_name == 'pull_request_review'");
  });

  it("preserves every trusted source of actionable review/owner evidence", () => {
    for (const actor of ["ibboabdoli-ai", "coderabbitai[bot]", "chatgpt-codex-connector[bot]"]) {
      expect(preflight).toContain(actor);
    }
    for (const signal of [
      "<!-- proffera-worker-task-packet:v1 -->",
      "<!-- proffera-owner-approval:",
      "proffera-codex-fallback-review-request:",
      "Reviewed commit:",
      "recent_review_start",
      "Final exact-head review is complete for",
      "Review completed for exact HEAD",
      "Review limit reached",
      "Review rate limited",
      "temporarily unavailable",
      "service unavailable",
    ]) {
      expect(source, `Router shell must retain ${signal}`).toContain(signal);
      expect(preflight, `Job preflight must admit ${signal}`).toContain(signal);
    }
  });

  it("admits ReviewForge review events without admitting ReviewForge issue comments", () => {
    // PR #954 will install the exact-head, CodeRabbit-quota and approval
    // checks downstream. This job prefilter must not suppress those events.
    const [reviewEvents, commentEvents = ""] = preflight.split(
      "|| (github.event_name == 'issue_comment'"
    );
    expect(reviewEvents).toContain("github.actor == 'reviewforge-ibbo-dev[bot]'");
    expect(commentEvents).not.toContain("reviewforge-ibbo-dev[bot]");
    expect(source).toContain("Review actor is not a trusted control-plane reviewer.");
  });

  it("does not preadmit general bot comments or comments outside PRs and issue 548", () => {
    expect(preflight).not.toContain("vercel[bot]");
    expect(preflight).toContain("github.event.issue.pull_request != null");
    expect(preflight).toContain("github.event.issue.number == 548");
    expect(source).toContain("PR comment is unrelated to current final-gate routing.");
    expect(source).toContain("Review actor is not a trusted control-plane reviewer.");
  });
});
