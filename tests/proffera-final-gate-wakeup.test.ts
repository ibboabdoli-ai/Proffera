import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replaceAll("\r\n", "\n");
}

const reviewHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const oldHead = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const codeRabbitInvocationMarker = `<!-- CodeRabbit review command invocation: v2:${"c".repeat(64)} -->`;

function wakeupShellBlock() {
  const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
  const startMarker = '          pr_number="${INPUT_PR_NUMBER:-}"';
  const endMarker = '          echo "Re-ran only the exact-head E2E public smoke final gate after review evidence changed."';
  const start = wakeup.indexOf(startMarker);
  const end = wakeup.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return wakeup
    .slice(start, end + endMarker.length)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

function automergeAiReviewShellBlock() {
  const automerge = source(".github/workflows/proffera-automerge.yml");
  const startMarker = '          file_count="$(grep -c . <<< "$changed_files" || true)"';
  const endMarker = '          checks_json=""';
  const start = automerge.indexOf(startMarker);
  const end = automerge.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return automerge
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

type WakeupFixture = {
  actor?: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  sourceEvent?: "issue_comment" | "pull_request_review";
  reviewState?: string;
  reviewCommit?: string;
  comments?: Array<Record<string, unknown>>;
  firstReviews?: Array<Record<string, unknown>>;
  laterReviews?: Array<Record<string, unknown>>;
  liveHead?: string;
};

type AutomergeFixture = {
  comments?: Array<Record<string, unknown>>;
  firstReviews?: Array<Record<string, unknown>>;
  laterReviews?: Array<Record<string, unknown>>;
  liveHead?: string;
};

function toNdjson(items: Array<Record<string, unknown>> = []) {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

function runWakeupFixture(fixture: WakeupFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-wakeup-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "wakeup.sh");
  const reviewState = join(dir, "review-state");
  const rerunState = join(dir, "rerun-state");

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [ "$1" = "api" ] && [ "\${2:-}" = "repos/ibboabdoli-ai/Proffera/issues/comments/9001" ]; then
  printf '%s\\n' "$FAKE_SOURCE_JSON"
  exit 0
fi
if [ "$1" = "api" ] && [ "\${2:-}" = "repos/ibboabdoli-ai/Proffera/pulls/801/reviews/9001" ]; then
  printf '%s\\n' "$FAKE_SOURCE_JSON"
  exit 0
fi
if [ "$1" = "api" ] && [ "\${2:-}" = "repos/ibboabdoli-ai/Proffera/pulls/801" ]; then
  if [[ "$args" == *"--jq .head.sha"* ]]; then
    printf '%s\\n' "\${FAKE_LIVE_HEAD:-$FAKE_HEAD_SHA}"
  else
    printf '{"state":"open","draft":false,"head":{"sha":"%s"}}\\n' "$FAKE_HEAD_SHA"
  fi
  exit 0
fi
if [[ "$args" == *"/issues/801/comments?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_COMMENTS"
  exit 0
fi
if [[ "$args" == *"/pulls/801/reviews?per_page=100"* ]]; then
  count=0
  [ -f "$FAKE_REVIEW_STATE" ] && count="$(cat "$FAKE_REVIEW_STATE")"
  if [ "$count" -eq 0 ]; then
    printf '%s\\n' "$FAKE_FIRST_REVIEWS"
  else
    printf '%s\\n' "$FAKE_LATER_REVIEWS"
  fi
  printf '%s' "$((count + 1))" > "$FAKE_REVIEW_STATE"
  exit 0
fi
if [[ "$args" == *"/actions/workflows/ci.yml/runs?event=pull_request&per_page=100"* ]]; then
  printf '{"id":71,"head_sha":"%s","created_at":"2026-09-05T12:00:00Z"}\\n' "$FAKE_HEAD_SHA"
  exit 0
fi
if [[ "$args" == *"/actions/runs/71/jobs?filter=all&per_page=100"* ]]; then
  cat <<'JSON'
{"id":1,"name":"Validate","status":"completed","conclusion":"success","run_attempt":1}
{"id":2,"name":"AI review route","status":"completed","conclusion":"success","run_attempt":1}
{"id":3,"name":"E2E public smoke run","status":"completed","conclusion":"success","run_attempt":1}
{"id":4,"name":"E2E public smoke","status":"completed","conclusion":"failure","run_attempt":1}
JSON
  exit 0
fi
if [[ "$args" == *"--method POST"* && "$args" == *"actions/jobs/4/rerun"* ]]; then
  printf 'rerun\\n' > "$FAKE_RERUN_STATE"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 91
`, { mode: 0o755 });

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
REPOSITORY=ibboabdoli-ai/Proffera
EVENT_NAME=workflow_dispatch
EVENT_ACTOR=ibboabdoli-ai
EVENT_PR_NUMBER=''
EVENT_ISSUE_NUMBER=''
EVENT_COMMENT_BODY=''
EVENT_COMMENT_CREATED_AT=''
EVENT_REVIEW_STATE=''
EVENT_REVIEW_COMMIT=''
INPUT_PR_NUMBER=801
INPUT_SOURCE_EVENT=${fixture.sourceEvent ?? "issue_comment"}
INPUT_SOURCE_ID=9001
INPUT_SOURCE_ACTOR='${fixture.actor ?? "coderabbitai[bot]"}'
INPUT_SOURCE_EVIDENCE_TIME='${fixture.updatedAt ?? fixture.createdAt ?? "2099-09-05T12:03:00Z"}'
INPUT_SOURCE_REVIEW_COMMIT='${fixture.sourceEvent === "pull_request_review" ? (fixture.reviewCommit ?? reviewHead) : ""}'
TRUSTED_CODEX_REQUESTER=ibboabdoli-ai
${wakeupShellBlock()}
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_EVENT_BODY: fixture.body,
      FAKE_SOURCE_JSON: JSON.stringify(fixture.sourceEvent === "pull_request_review" ? {
        id: 9001,
        user: { login: fixture.actor ?? "coderabbitai[bot]" },
        state: fixture.reviewState ?? "COMMENTED",
        submitted_at: fixture.createdAt ?? "2099-09-05T12:03:00Z",
        commit_id: fixture.reviewCommit ?? reviewHead,
      } : {
        id: 9001,
        user: { login: fixture.actor ?? "coderabbitai[bot]" },
        body: fixture.body,
        created_at: fixture.createdAt ?? "2099-09-05T12:03:00Z",
        updated_at: fixture.updatedAt ?? fixture.createdAt ?? "2099-09-05T12:03:00Z",
        issue_url: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/801",
      }),
      FAKE_HEAD_SHA: reviewHead,
      FAKE_LIVE_HEAD: fixture.liveHead ?? "",
      FAKE_COMMENTS: toNdjson(fixture.comments),
      FAKE_FIRST_REVIEWS: toNdjson(fixture.firstReviews),
      FAKE_LATER_REVIEWS: toNdjson(fixture.laterReviews ?? fixture.firstReviews),
      FAKE_REVIEW_STATE: reviewState,
      FAKE_RERUN_STATE: rerunState,
    },
  });

  const rerun = (() => {
    try {
      return readFileSync(rerunState, "utf8").trim() === "rerun";
    } catch {
      return false;
    }
  })();

  rmSync(dir, { recursive: true, force: true });
  return { result, rerun };
}

function runAutomergeFixture(fixture: AutomergeFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-clean-comment-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "automerge-review.sh");
  const reviewState = join(dir, "review-state");

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"/pulls/695/reviews?per_page=100"* ]]; then
  count=0
  [ -f "$FAKE_REVIEW_STATE" ] && count="$(cat "$FAKE_REVIEW_STATE")"
  if [ "$count" -eq 0 ]; then
    printf '%s\\n' "$FAKE_FIRST_REVIEWS"
  else
    printf '%s\\n' "$FAKE_LATER_REVIEWS"
  fi
  printf '%s' "$((count + 1))" > "$FAKE_REVIEW_STATE"
  exit 0
fi
if [[ "$args" == *"/issues/695/comments?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_COMMENTS"
  exit 0
fi
if [ "$1" = "api" ] && [ "\${2:-}" = "repos/ibboabdoli-ai/Proffera/pulls/695" ] && [[ "$args" == *"--jq .head.sha"* ]]; then
  printf '%s\\n' "\${FAKE_LIVE_HEAD:-$FAKE_HEAD_SHA}"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 92
`, { mode: 0o755 });

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
REPOSITORY=ibboabdoli-ai/Proffera
pr_number=695
head_sha=${reviewHead}
HUMAN_APPROVER=ibboabdoli-ai
changed_files="$(printf 'src/features/example-%s.ts\\n' {1..12})"
pr_json='{"labels":[{"name":"needs-ai-review"}]}'
${automergeAiReviewShellBlock()}
printf 'AI_REVIEW_OK\\n'
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_HEAD_SHA: reviewHead,
      FAKE_LIVE_HEAD: fixture.liveHead ?? "",
      FAKE_COMMENTS: toNdjson(fixture.comments),
      FAKE_FIRST_REVIEWS: toNdjson(fixture.firstReviews),
      FAKE_LATER_REVIEWS: toNdjson(fixture.laterReviews ?? fixture.firstReviews),
      FAKE_REVIEW_STATE: reviewState,
    },
  });

  rmSync(dir, { recursive: true, force: true });
  return result;
}

function requestComment(createdAt = "2099-09-05T12:00:00Z") {
  return {
    id: 10,
    user: { login: "github-actions[bot]" },
    body: `<!-- proffera-coderabbit-final-review-request:${reviewHead} -->\n@coderabbitai review`,
    created_at: createdAt,
  };
}

function codeRabbitInvocation(createdAt = "2099-09-05T12:01:00Z") {
  return {
    id: 9,
    user: { login: "coderabbitai[bot]" },
    body: `${codeRabbitInvocationMarker}\n<details>\n<summary>🧩 Analysis chain</summary>\n</details>`,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function codeRabbitCompletedReview(submittedAt = "2099-09-05T12:02:00Z", commitId = reviewHead) {
  return {
    user: { login: "coderabbitai[bot]" },
    commit_id: commitId,
    state: "COMMENTED",
    submitted_at: submittedAt,
  };
}

function cleanBody(head = reviewHead, marker = codeRabbitInvocationMarker) {
  return `${marker}\n@ibboabdoli-ai Final exact-head review is complete for \`${head}\`.\n\nI found no issues.`;
}

function cleanIssueComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    user: { login: "coderabbitai[bot]" },
    body: cleanBody(),
    created_at: "2099-09-05T12:03:00Z",
    updated_at: "2099-09-05T12:03:00Z",
    ...overrides,
  };
}

describe("event-driven final review gate", () => {
  it("keeps the required final gate exact-head and wakes only that job after review evidence changes", () => {
    const ci = source(".github/workflows/ci.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    const automerge = source(".github/workflows/proffera-automerge.yml");

    expect(ci).toContain("name: E2E public smoke");
    expect(ci).toContain("No completed CodeRabbit review for current head yet; high-risk path remains CodeRabbit-only while waiting for a review or provider signal.");
    expect(ci).toContain("CodeRabbit high-risk availability timeout reached; exact-head Codex fallback will be allowed on the next poll.");
    expect(ci).toContain('echo "CodeRabbit changes remain requested for current head; Codex fallback cannot clear them."\n              exit 1');

    const router = source(".github/workflows/supervisor-event-router.yml");
    expect(wakeup).not.toContain("pull_request_review:");
    expect(wakeup).not.toContain("issue_comment:");
    expect(wakeup).toContain("workflow_dispatch:");
    expect(router).toContain("pull_request_review:");
    expect(router).toContain("issue_comment:");
    expect(router).toContain('"coderabbitai[bot]"');
    expect(router).toContain('"chatgpt-codex-connector[bot]"');
    expect(router).toContain('"ibboabdoli-ai"');
    expect(router).toContain("Final exact-head review is complete for");
    expect(router).toContain("proffera-codex-fallback-review-request:");
    expect(router).toContain("@codex review");
    expect(router).toContain("proffera-final-gate-wakeup.yml");
    expect(router).toContain("-f source_event=");
    expect(router).toContain("-f source_id=");
    expect(router).toContain("-f source_evidence_time=");
    expect(router).toContain('dispatch_final_gate "$pr_number" || final_gate_status=$?');
    const reviewRepairDispatch = router.indexOf("gh workflow run supervisor-review-repair.yml");
    const finalGateFailure = router.indexOf('if [ "$final_gate_status" -ne 0 ]', reviewRepairDispatch);
    expect(reviewRepairDispatch).toBeGreaterThanOrEqual(0);
    expect(finalGateFailure).toBeGreaterThan(reviewRepairDispatch);
    expect(wakeup).toContain("issues/comments/$INPUT_SOURCE_ID");
    expect(wakeup).toContain("INPUT_SOURCE_EVIDENCE_TIME");
    expect(ci).not.toContain("clean_summary_count");
    expect(ci).not.toContain("coderabbit_review_completion_time");
    expect(automerge).not.toContain("clean_summary_count");
    expect(automerge).not.toContain("coderabbit_review_completion_time");
    expect(ci).toContain('terminal_count="$(jq -r');
    expect(automerge).toContain('terminal_count="$(jq -r');
    expect(wakeup).toContain("EVENT_COMMENT_CREATED_AT");
    expect(wakeup).toContain("coderabbit_review_completion_time");
    expect(wakeup).toContain('select(.state == "APPROVED" or .state == "COMMENTED")');
    expect(wakeup).toContain('select((.submitted_at // "") >= $request_time)');
    expect(wakeup).toContain("<!-- CodeRabbit review command invocation: v2:");
    expect(wakeup).toContain("[0-9a-f]{64}");
    expect(wakeup).toContain("Final exact-head review is complete for");
    expect(wakeup).toContain("I found no issues\\\\.");
    expect(wakeup).toContain("Untrusted pull-request review actor cannot wake the final gate.");
    expect(wakeup).toContain('"coderabbitai[bot]"|"chatgpt-codex-connector[bot]"');
    expect(wakeup).toContain("Untrusted issue-comment actor cannot wake the final gate.");
    expect(wakeup).toContain('"coderabbitai[bot]"|"chatgpt-codex-connector[bot]"|"$TRUSTED_CODEX_REQUESTER"');
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

    expect(automerge).toContain("workflow_run:");
    expect(automerge).toContain("workflows: [CI, Security review regressions]");
    expect(automerge).toContain("E2E public smoke");
    expect(automerge).not.toContain("pull_request_review:");
    expect(automerge).not.toContain("issue_comment:");
  });

  it("normalizes REST CHANGES_REQUESTED before the final-gate wakeup guard", () => {
    const blocked = runWakeupFixture({
      sourceEvent: "pull_request_review",
      actor: "coderabbitai[bot]",
      body: "",
      createdAt: "2099-09-05T12:03:00Z",
      reviewState: "CHANGES_REQUESTED",
      reviewCommit: reviewHead,
    });

    expect(blocked.result.status).toBe(0);
    expect(blocked.rerun).toBe(false);
    expect(`${blocked.result.stdout}${blocked.result.stderr}`).toContain(
      "A blocking review does not need a final-gate rerun.",
    );
  });

  it("allows final-gate wakeup only from trusted pull-request review bots", () => {
    const untrusted = runWakeupFixture({
      sourceEvent: "pull_request_review",
      actor: "ibboabdoli-ai",
      body: "",
      createdAt: "2099-09-05T12:03:00Z",
      reviewState: "COMMENTED",
      reviewCommit: reviewHead,
    });
    expect(untrusted.result.status).toBe(0);
    expect(untrusted.rerun).toBe(false);
    expect(`${untrusted.result.stdout}${untrusted.result.stderr}`).toContain(
      "Untrusted pull-request review actor cannot wake the final gate.",
    );

    const trusted = runWakeupFixture({
      sourceEvent: "pull_request_review",
      actor: "coderabbitai[bot]",
      body: "",
      createdAt: "2099-09-05T12:03:00Z",
      reviewState: "COMMENTED",
      reviewCommit: reviewHead,
    });
    expect(trusted.result.status).toBe(0);
    expect(trusted.rerun).toBe(true);
  });

  it("wakes for trusted current-head CodeRabbit clean completion comments and rejects spoofed or stale clean evidence", () => {
    const positive = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
    });
    expect(positive.result.status).toBe(0);
    expect(positive.rerun).toBe(true);

    const human = runWakeupFixture({
      actor: "ibboabdoli-ai",
      body: cleanBody(),
      comments: [requestComment()],
    });
    expect(human.rerun).toBe(false);

    const wrongBot = runWakeupFixture({
      actor: "other-review-bot[bot]",
      body: cleanBody(),
      comments: [requestComment()],
    });
    expect(wrongBot.rerun).toBe(false);

    const proseWithoutProviderMarker = runWakeupFixture({
      body: `Final exact-head review is complete for ${reviewHead}.\n\nI found no issues.`,
      comments: [requestComment()],
    });
    expect(proseWithoutProviderMarker.rerun).toBe(false);

    const malformedProviderMarker = runWakeupFixture({
      body: cleanBody(reviewHead, `<!-- CodeRabbit review command invocation: v2:${"A".repeat(64)} -->`),
      comments: [requestComment()],
    });
    expect(malformedProviderMarker.rerun).toBe(false);

    const untrustedRequest = runWakeupFixture({
      body: cleanBody(),
      comments: [{ ...requestComment(), user: { login: "ibboabdoli-ai" } }],
    });
    expect(untrustedRequest.rerun).toBe(false);

    const inexactRequest = runWakeupFixture({
      body: cleanBody(),
      comments: [{
        ...requestComment(),
        body: `<!-- proffera-coderabbit-final-review-request:${reviewHead} -->`,
      }],
    });
    expect(inexactRequest.rerun).toBe(false);

    const stale = runWakeupFixture({
      body: cleanBody(oldHead),
      comments: [requestComment()],
    });
    expect(stale.rerun).toBe(false);

    const preRequest = runWakeupFixture({
      body: cleanBody(),
      createdAt: "2099-09-05T11:59:00Z",
      comments: [requestComment()],
    });
    expect(preRequest.rerun).toBe(false);

    const editedPreRequest = runWakeupFixture({
      body: cleanBody(),
      createdAt: "2099-09-05T11:59:00Z",
      updatedAt: "2099-09-05T12:03:00Z",
      comments: [requestComment()],
    });
    expect(editedPreRequest.rerun).toBe(false);

    const incomplete = runWakeupFixture({
      body: `${cleanBody()}\n\nAction not completed: review incomplete`,
      comments: [requestComment()],
    });
    expect(incomplete.rerun).toBe(false);

    const inexactCompletionSentence = runWakeupFixture({
      body: `${codeRabbitInvocationMarker}\nFinal exact-head review is complete for ${reviewHead}, but more work remains.\n\nI found no issues.`,
      comments: [requestComment()],
    });
    expect(inexactCompletionSentence.rerun).toBe(false);

    const generic = runWakeupFixture({
      body: `Reviewed ${reviewHead}. Dependency scope looks focused.`,
      comments: [requestComment()],
    });
    expect(generic.rerun).toBe(false);

    const blocked = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
      firstReviews: [{
        user: { login: "coderabbitai[bot]" },
        commit_id: reviewHead,
        state: "CHANGES_REQUESTED",
        submitted_at: "2099-09-05T12:02:00Z",
      }],
    });
    expect(blocked.rerun).toBe(false);

    const headChanged = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
      liveHead: "cccccccccccccccccccccccccccccccccccccccc",
    });
    expect(headChanged.rerun).toBe(false);
    expect(`${headChanged.result.stdout}${headChanged.result.stderr}`).toContain("Review evidence became stale before final-gate wakeup");

    const reviewRace = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
      firstReviews: [],
      laterReviews: [{
        user: { login: "coderabbitai[bot]" },
        commit_id: reviewHead,
        state: "CHANGES_REQUESTED",
        submitted_at: "2099-09-05T12:04:00Z",
      }],
    });
    expect(reviewRace.rerun).toBe(false);
    expect(`${reviewRace.result.stdout}${reviewRace.result.stderr}`).toContain("CodeRabbit changes were recorded before final-gate wakeup");
  }, 120000);

  it("requires a post-request completed current-head CodeRabbit review before accepting a persistent summary", () => {
    const summaryBody = `<!-- recent_review_start -->
No actionable comments were generated in the recent review.
${reviewHead}
<!-- recent_review_end -->`;

    const invocationAlone = runWakeupFixture({
      body: summaryBody,
      createdAt: "2099-09-05T12:01:30Z",
      updatedAt: "2099-09-05T12:03:00Z",
      comments: [
        requestComment("2099-09-05T12:00:00Z"),
        codeRabbitInvocation("2099-09-05T12:01:00Z"),
      ],
    });
    expect(invocationAlone.rerun).toBe(false);
    expect(`${invocationAlone.result.stdout}${invocationAlone.result.stderr}`).toContain(
      "CodeRabbit summary is not bound to a post-request completed current-head review",
    );

    const editedPreRequestSummary = runWakeupFixture({
      body: summaryBody,
      createdAt: "2099-09-05T11:50:00Z",
      updatedAt: "2099-09-05T12:03:00Z",
      comments: [
        requestComment("2099-09-05T12:00:00Z"),
        codeRabbitInvocation("2099-09-05T12:01:00Z"),
      ],
    });
    expect(editedPreRequestSummary.rerun).toBe(false);

    const completedCurrentHeadReview = runWakeupFixture({
      body: summaryBody,
      createdAt: "2099-09-05T11:50:00Z",
      updatedAt: "2099-09-05T12:03:00Z",
      comments: [requestComment("2099-09-05T12:00:00Z")],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
    });
    expect(completedCurrentHeadReview.result.status).toBe(0);
    expect(completedCurrentHeadReview.rerun).toBe(true);
  }, 120000);

  it("does not classify availability/status comments as the new clean CodeRabbit decision", () => {
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    const cleanPredicateStart = wakeup.indexOf('clean_comment_match="$(jq -rn');
    const cleanPredicateEnd = wakeup.indexOf('if [ "$clean_comment_match" != "true" ]', cleanPredicateStart);
    const cleanPredicate = wakeup.slice(cleanPredicateStart, cleanPredicateEnd);

    expect(cleanPredicate).toContain("Final exact-head review is complete for");
    expect(cleanPredicate).toContain("I found no issues");
    expect(cleanPredicate).toContain("CodeRabbit review command invocation: v2:[0-9a-f]{64}");
    expect(cleanPredicate).toContain("Review limit reached");
    expect(cleanPredicate).toContain("Review skipped");
    expect(cleanPredicate).toContain("| not");
  });

  it("recognizes the same trusted clean exact-head CodeRabbit evidence in gated automerge", () => {
    const positive = runAutomergeFixture({
      comments: [requestComment(), cleanIssueComment()],
    });
    expect(positive.status).toBe(0);
    expect(positive.stdout).toContain("AI_REVIEW_OK");

    const summaryBody = `<!-- recent_review_start -->\nNo actionable comments were generated in the recent review.\n${reviewHead}\n<!-- recent_review_end -->`;
    const editedSummary = {
      id: 15,
      user: { login: "coderabbitai[bot]" },
      body: summaryBody,
      created_at: "2099-09-05T11:50:00Z",
      updated_at: "2099-09-05T12:03:00Z",
    };
    const summaryWithoutCompletion = runAutomergeFixture({
      comments: [requestComment("2099-09-05T12:00:00Z"), editedSummary],
    });
    expect(summaryWithoutCompletion.stdout).not.toContain("AI_REVIEW_OK");

    const summaryWithInvocationOnly = runAutomergeFixture({
      comments: [
        requestComment("2099-09-05T12:00:00Z"),
        codeRabbitInvocation("2099-09-05T12:01:00Z"),
        editedSummary,
      ],
    });
    expect(summaryWithInvocationOnly.stdout).not.toContain("AI_REVIEW_OK");

    const summaryWithCompletedCurrentHeadReview = runAutomergeFixture({
      comments: [requestComment("2099-09-05T12:00:00Z"), editedSummary],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
    });
    expect(summaryWithCompletedCurrentHeadReview.stdout).toContain("AI_REVIEW_OK");

    const negatives = [
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({
          body: `Final exact-head review is complete for ${reviewHead}.\n\nI found no issues.`,
        })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({
          body: cleanBody(reviewHead, `<!-- CodeRabbit review command invocation: v2:${"A".repeat(64)} -->`),
        })],
      }),
      runAutomergeFixture({
        comments: [{ ...requestComment(), user: { login: "ibboabdoli-ai" } }, cleanIssueComment()],
      }),
      runAutomergeFixture({
        comments: [{
          ...requestComment(),
          body: `<!-- proffera-coderabbit-final-review-request:${reviewHead} -->`,
        }, cleanIssueComment()],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({ user: { login: "ibboabdoli-ai" } })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({ user: { login: "other-review-bot[bot]" } })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({ body: cleanBody(oldHead) })],
      }),
      runAutomergeFixture({
        comments: [requestComment("2099-09-05T12:05:00Z"), cleanIssueComment()],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({
          created_at: "2099-09-05T11:59:00Z",
          updated_at: "2099-09-05T12:03:00Z",
        })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({
          body: `${cleanBody()}\n\nAction not completed: review incomplete`,
        })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), cleanIssueComment({
          body: `${codeRabbitInvocationMarker}\nFinal exact-head review is complete for ${reviewHead}, but more work remains.\n\nI found no issues.`,
        })],
      }),
      runAutomergeFixture({
        comments: [requestComment(), {
          id: 12,
          user: { login: "coderabbitai[bot]" },
          body: "Review limit reached",
          created_at: "2099-09-05T12:03:00Z",
          updated_at: "2099-09-05T12:03:00Z",
        }],
      }),
      runAutomergeFixture({
        comments: [requestComment(), {
          id: 13,
          user: { login: "coderabbitai[bot]" },
          body: "Review skipped",
          created_at: "2099-09-05T12:03:00Z",
          updated_at: "2099-09-05T12:03:00Z",
        }],
      }),
      runAutomergeFixture({
        comments: [requestComment(), {
          id: 14,
          user: { login: "coderabbitai[bot]" },
          body: `Reviewed ${reviewHead}. Dependency scope looks focused.`,
          created_at: "2099-09-05T12:03:00Z",
        }],
      }),
    ];

    for (const result of negatives) {
      expect(result.stdout).not.toContain("AI_REVIEW_OK");
    }

    const blocked = runAutomergeFixture({
      comments: [requestComment(), cleanIssueComment()],
      firstReviews: [{
        user: { login: "coderabbitai[bot]" },
        commit_id: reviewHead,
        state: "CHANGES_REQUESTED",
        submitted_at: "2099-09-05T12:04:00Z",
      }],
    });
    expect(blocked.stdout).not.toContain("AI_REVIEW_OK");
    expect(blocked.stdout).toContain("CodeRabbit changes remain requested on the current PR head");

    const headChanged = runAutomergeFixture({
      comments: [requestComment(), cleanIssueComment()],
      liveHead: "cccccccccccccccccccccccccccccccccccccccc",
    });
    expect(headChanged.stdout).not.toContain("AI_REVIEW_OK");
    expect(headChanged.stdout).toContain("clean CodeRabbit comment became stale before automerge review acceptance");

    const reviewRace = runAutomergeFixture({
      comments: [requestComment(), cleanIssueComment()],
      firstReviews: [],
      laterReviews: [{
        user: { login: "coderabbitai[bot]" },
        commit_id: reviewHead,
        state: "CHANGES_REQUESTED",
        submitted_at: "2099-09-05T12:04:00Z",
      }],
    });
    expect(reviewRace.stdout).not.toContain("AI_REVIEW_OK");
    expect(reviewRace.stdout).toContain("CodeRabbit changes were recorded before clean-comment automerge acceptance");
  }, 120000);

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
