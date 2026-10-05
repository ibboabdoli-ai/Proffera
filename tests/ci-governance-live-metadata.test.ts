import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8").replaceAll("\r\n", "\n");

describe("CI governance live PR metadata", () => {
  it("re-reads same-head PR metadata instead of trusting a stale event-body snapshot", () => {
    expect(ci).not.toContain("PR_BODY: ${{ github.event.pull_request.body }}");
    expect(ci).toContain("EVENT_HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
    expect(ci).toContain('live_pr="$(gh api "repos/${REPOSITORY}/pulls/${PR_NUMBER}")"');
    expect(ci).toContain("live_head_sha=\"$(jq -r '.head.sha' <<< \"$live_pr\")\"");
    expect(ci).toContain("live_base_sha=\"$(jq -r '.base.sha' <<< \"$live_pr\")\"");
    expect(ci).toContain("live_head_ref=\"$(jq -r '.head.ref' <<< \"$live_pr\")\"");
    expect(ci).toContain("PR_BODY=\"$(jq -r '.body // \"\"' <<< \"$live_pr\")\"");
  });

  it("fails closed if queued governance no longer targets the event head, base, or branch", () => {
    expect(ci).toContain('if [ "$live_head_sha" != "$EVENT_HEAD_SHA" ]; then');
    expect(ci).toContain('if [ "$live_base_sha" != "$BASE_SHA" ]; then');
    expect(ci).toContain('if [ "$live_head_ref" != "$HEAD_REF" ]; then');
    expect(ci).toContain("without allowing a queued run to validate a different code revision");
  });
});
