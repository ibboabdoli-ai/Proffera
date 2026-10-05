import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  const endMarker = '          echo "Final-gate memory decision handled: $retry_decision"';
  const start = wakeup.indexOf(startMarker);
  const end = wakeup.indexOf(endMarker, start) + endMarker.length;
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return wakeup
    .slice(start, end)
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
  adapterFault?: "blocking_review" | "new_attempt" | "post_timeout" | "missing_job_head" | "wrong_job_head";
  actor?: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  sourceEvent?: "issue_comment" | "pull_request_review";
  reviewState?: string;
  reviewCommit?: string;
  routedActor?: string;
  routedEvidenceTime?: string;
  routedReviewCommit?: string;
  sourceIssueUrl?: string;
  comments?: Array<Record<string, unknown>>;
  firstReviews?: Array<Record<string, unknown>>;
  laterReviews?: Array<Record<string, unknown>>;
  liveHead?: string;
};

type AutomergeFixture = {
  comments?: Array<Record<string, unknown>>;
  firstReviews?: Array<Record<string, unknown>>;
  laterReviews?: Array<Record<string, unknown>>;
  inlineComments?: Array<Record<string, unknown>>;
  liveHead?: string;
};

function toNdjson(items: Array<Record<string, unknown>> = []) {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

function runWakeupFixture(fixture: WakeupFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-wakeup-"));
  const script = join(dir, "wakeup.sh");
  const driver = join(dir, "github-fixture.mjs");
  const statePath = join(dir, "state.json");
  writeFileSync(statePath, JSON.stringify({ fixture, memory: [], ops: [], posts: 0, reviewsRead: 0, headReads: 0, verified: false }));
  // Both shell admission and the real imported adapter share one durable fake API.
  // No command falls through to real gh, and only POST /rerun increments posts.
  writeFileSync(driver, String.raw`
import { readFileSync, writeFileSync } from 'node:fs';
import { runLiveFinalGate } from '${pathToFileURL(resolve(process.cwd(), "scripts/supervisor-final-gate-live.mjs")).href}';
const statePath = process.env.FAKE_STATE_PATH;
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const f = state.fixture;
const head = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const base = 'repos/ibboabdoli-ai/Proffera';
const when = f.createdAt ?? '2099-09-05T12:03:00Z';
const actor = f.actor ?? 'coderabbitai[bot]';
const states = () => state.memory.length ? JSON.parse(state.memory[0].body.split('\n')[2]).intents.map(i => i.state) : [];
const prepared = () => states().includes('PREPARED');
const jobs = ['Validate','AI review route','E2E public smoke run','E2E public smoke'].map((name,i) => ({ id:i+1, run_id:71, head_sha:head, run_attempt:1, name, status:'completed', conclusion:i===3?'failure':'success', started_at:'2099-09-05T12:01:00Z', completed_at:'2099-09-05T12:02:00Z' }));
if (f.adapterFault === 'missing_job_head') jobs.forEach(job => delete job.head_sha);
if (f.adapterFault === 'wrong_job_head') jobs[3].head_sha = 'b'.repeat(40);
function respond(args) {
  const endpoint = args.find(arg => arg.startsWith('repos/'));
  if (!endpoint) throw Error('No fake endpoint');
  const method = args.includes('--method') ? args[args.indexOf('--method')+1] : 'GET';
  state.ops.push({ endpoint, method, states: states() });
  let value;
  if (endpoint === base + '/actions/jobs/4/rerun') {
    if (method !== 'POST' || !prepared() || !state.verified) throw Error('POST preceded verified durable PREPARED');
    state.posts++;
    if (f.adapterFault === 'post_timeout') throw Error('unknown acceptance');
    return 'HTTP/2.0 201 Created\n{}';
  }
  if (method !== 'GET') {
    if (endpoint !== base + '/issues/548/comments' && endpoint !== base + '/issues/comments/123') throw Error('Unexpected fake write');
    const body = args.find(arg => arg.startsWith('body=')).slice(5);
    state.memory = [{ id:123, user:{login:'github-actions[bot]',type:'Bot'}, issue_url:'https://api.github.com/' + base + '/issues/548', body }];
    state.verified = false;
    value = state.memory[0];
  } else if (endpoint.includes('/issues/548/comments')) {
    value = state.memory;
    if (prepared()) state.verified = true;
  } else if (endpoint === base + '/issues/comments/123') value = state.memory[0];
  else if (endpoint === base + '/issues/comments/9001' || endpoint === base + '/pulls/801/reviews/9001') {
    value = { id:9001, user:{login:actor}, body:f.body, created_at:when, updated_at:f.updatedAt ?? when, submitted_at:when, state:f.reviewState ?? 'COMMENTED', commit_id:f.reviewCommit ?? head, issue_url:f.sourceIssueUrl ?? 'https://api.github.com/' + base + '/issues/801' };
  } else if (endpoint === base + '/pulls/801') {
    state.headReads++;
    value = { number:801,state:'open',draft:false,head:{sha:state.headReads>1?(f.liveHead || head):head},base:{repo:{full_name:'ibboabdoli-ai/Proffera'}} };
  } else if (endpoint.includes('/issues/801/comments?')) value = f.comments ?? [];
  else if (endpoint.includes('/pulls/801/reviews?')) {
    value = state.reviewsRead++ === 0 ? f.firstReviews ?? [] : f.laterReviews ?? f.firstReviews ?? [];
    if (prepared() && f.adapterFault === 'blocking_review') value = [...value,{id:888,user:{login:'coderabbitai[bot]'},commit_id:head,state:'CHANGES_REQUESTED',submitted_at:'2099-09-05T12:04:00Z'}];
  } else if (endpoint.includes('/pulls/801/comments?')) value = [];
  else if (endpoint.includes('/actions/workflows/ci.yml/runs?')) value = {workflow_runs:[{id:71,head_sha:head,created_at:'2099-09-05T12:00:00Z'}]};
  else if (endpoint === base + '/actions/runs/71') value = {id:71,head_sha:head,path:'.github/workflows/ci.yml',event:'pull_request',repository:{full_name:'ibboabdoli-ai/Proffera'},pull_requests:[{number:801}],run_attempt:prepared() && f.adapterFault==='new_attempt'?2:1};
  else if (endpoint.includes('/actions/runs/71/jobs?')) value = {total_count:jobs.length,jobs};
  else if (endpoint === base + '/actions/jobs/4') value = jobs[3];
  else throw Error('Unsimulated ' + method + ' ' + endpoint);
  if (args.includes('--jq')) {
    const query = args[args.indexOf('--jq')+1];
    if (query === '.head.sha') return value.head.sha;
    const items = query === '.[]' ? value : query === '.jobs[]' ? value.jobs : query === '.workflow_runs[]' ? value.workflow_runs : null;
    if (!items) throw Error('Unsupported fake jq');
    return items.map(item => JSON.stringify(item)).join('\n');
  }
  return JSON.stringify(value);
}
try {
  if (process.argv[2] === 'gh') process.stdout.write(respond(process.argv.slice(3)) + '\n');
  else {
    const input = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    const result = runLiveFinalGate(input, (file,args) => {if(file!=='gh')throw Error('Unexpected command');return respond(args);}, () => '2099-09-05T12:05:00Z');
    process.stdout.write(JSON.stringify(result));
  }
} catch (error) { console.error(error.message); process.exitCode=1; }
finally {writeFileSync(statePath, JSON.stringify(state));}
`);
  writeFileSync(join(dir, "gh"), '#!/usr/bin/env bash\nexec "$FAKE_NODE_BINARY" "$FAKE_DRIVER" gh "$@"\n', { mode: 0o755 });
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
node() { "$FAKE_NODE_BINARY" "$FAKE_DRIVER" adapter "$2"; }
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
INPUT_SOURCE_ACTOR='${fixture.routedActor ?? fixture.actor ?? "coderabbitai[bot]"}'
INPUT_SOURCE_EVIDENCE_TIME='${fixture.routedEvidenceTime ?? fixture.updatedAt ?? fixture.createdAt ?? "2099-09-05T12:03:00Z"}'
INPUT_SOURCE_REVIEW_COMMIT='${fixture.sourceEvent === "pull_request_review" ? (fixture.routedReviewCommit ?? fixture.reviewCommit ?? reviewHead) : ""}'
TRUSTED_CODEX_REQUESTER=ibboabdoli-ai
${wakeupShellBlock()}
`, { mode: 0o755 });
  const result = spawnSync("bash", [script], {
    cwd: dir, encoding: "utf8",
    env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`, FAKE_NODE_BINARY: process.execPath.replaceAll("\\", "/"), FAKE_DRIVER: driver.replaceAll("\\", "/"), FAKE_STATE_PATH: statePath },
  });
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const intents = state.memory.length ? JSON.parse(state.memory[0].body.split("\n")[2]).intents : [];
  rmSync(dir, { recursive: true, force: true });
  return { result, rerun: state.posts > 0, posts: state.posts as number, intents: intents as Array<{state:string}>, ops: state.ops as Array<{endpoint:string;method:string;states:string[]}> };
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
if [[ "$args" == *"/pulls/695/comments?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_INLINE_COMMENTS"
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
      FAKE_INLINE_COMMENTS: toNdjson(fixture.inlineComments),
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

function codeRabbitCompletedReview(submittedAt = "2099-09-05T12:02:00Z", commitId = reviewHead, id = 7001) {
  return {
    id,
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
    expect(wakeup).not.toContain("review_generation_id");
    expect(wakeup).toContain('EVENT_REVIEW_COMMIT" != "$head_sha');
    expect(wakeup).toContain('select(.head_sha == $sha)');
    expect(wakeup).toContain("jobs?filter=all&per_page=100");
    expect(wakeup).toContain("sort_by(.run_attempt // 0, .id)");
    expect(wakeup).toContain('require_success "Validate"');
    expect(wakeup).toContain('require_success "AI review route"');
    expect(wakeup).toContain('require_success "E2E public smoke run"');
    expect(wakeup).toContain('select(.name == "E2E public smoke")');
    expect(wakeup).toContain("scripts/supervisor-final-gate-live.mjs");
    expect(wakeup).toContain("proffera-final-gate-memory-${{ fromJSON(inputs.pr_number) }}");
    expect(wakeup).toContain("cancel-in-progress: false");
    expect(wakeup).toContain("issues: write");
    expect(wakeup).toContain("Failure Memory: ACCEPTED");
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

    expect(blocked.result.status, blocked.result.stdout + blocked.result.stderr).toBe(0);
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
    expect(untrusted.result.status, untrusted.result.stdout + untrusted.result.stderr).toBe(0);
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
    expect(trusted.result.status, trusted.result.stdout + trusted.result.stderr).toBe(0);
    expect(trusted.rerun).toBe(true);
  });

  it("fails closed when routed final-gate source provenance differs from fetched evidence", () => {
    const wrongPr = runWakeupFixture({
      body: cleanBody(),
      sourceIssueUrl: "https://api.github.com/repos/ibboabdoli-ai/Proffera/issues/802",
    });
    expect(wrongPr.result.status, wrongPr.result.stdout + wrongPr.result.stderr).toBe(0);
    expect(wrongPr.rerun).toBe(false);
    expect(`${wrongPr.result.stdout}${wrongPr.result.stderr}`).toContain(
      "Source comment changed or does not belong to this exact dispatch; refusing wakeup.",
    );

    const wrongActor = runWakeupFixture({
      body: cleanBody(),
      routedActor: "other-review-bot[bot]",
    });
    expect(wrongActor.result.status, wrongActor.result.stdout + wrongActor.result.stderr).toBe(0);
    expect(wrongActor.rerun).toBe(false);
    expect(`${wrongActor.result.stdout}${wrongActor.result.stderr}`).toContain(
      "Source comment changed or does not belong to this exact dispatch; refusing wakeup.",
    );

    const wrongEvidenceTime = runWakeupFixture({
      body: cleanBody(),
      updatedAt: "2099-09-05T12:03:00Z",
      routedEvidenceTime: "2099-09-05T12:02:59Z",
    });
    expect(wrongEvidenceTime.result.status, wrongEvidenceTime.result.stdout + wrongEvidenceTime.result.stderr).toBe(0);
    expect(wrongEvidenceTime.rerun).toBe(false);
    expect(`${wrongEvidenceTime.result.stdout}${wrongEvidenceTime.result.stderr}`).toContain(
      "Source comment changed or does not belong to this exact dispatch; refusing wakeup.",
    );

    const wrongReviewCommit = runWakeupFixture({
      sourceEvent: "pull_request_review",
      actor: "coderabbitai[bot]",
      body: "",
      createdAt: "2099-09-05T12:03:00Z",
      reviewState: "COMMENTED",
      reviewCommit: reviewHead,
      routedReviewCommit: oldHead,
    });
    expect(wrongReviewCommit.result.status, wrongReviewCommit.result.stdout + wrongReviewCommit.result.stderr).toBe(0);
    expect(wrongReviewCommit.rerun).toBe(false);
    expect(`${wrongReviewCommit.result.stdout}${wrongReviewCommit.result.stderr}`).toContain(
      "Source review changed or does not match the routed evidence; refusing wakeup.",
    );
  });

  it("wakes for trusted current-head CodeRabbit clean completion comments and rejects spoofed or stale clean evidence", () => {
    const commentBeforeReview = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
    });
    // CI accepts this authenticated clean exact-head comment independently.
    expect(commentBeforeReview.result.status, commentBeforeReview.result.stdout + commentBeforeReview.result.stderr).toBe(0);
    expect(commentBeforeReview.rerun).toBe(true);
    expect(commentBeforeReview.intents.map((i) => i.state)).toEqual(["ACCEPTED"]);

    const positive = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
      firstReviews: [codeRabbitCompletedReview()],
    });
    expect(positive.result.status, positive.result.stdout + positive.result.stderr).toBe(0);
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
    expect(`${editedPreRequest.result.stdout}${editedPreRequest.result.stderr}`).toContain(
      "CodeRabbit clean comment was not created after a trusted exact-head review request",
    );

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
      firstReviews: [codeRabbitCompletedReview()],
      liveHead: "cccccccccccccccccccccccccccccccccccccccc",
    });
    expect(headChanged.rerun).toBe(false);
    expect(`${headChanged.result.stdout}${headChanged.result.stderr}`).toContain("Review evidence became stale before final-gate wakeup");

    const reviewRace = runWakeupFixture({
      body: cleanBody(),
      comments: [requestComment()],
      firstReviews: [codeRabbitCompletedReview()],
      laterReviews: [
        codeRabbitCompletedReview(),
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: reviewHead,
          state: "CHANGES_REQUESTED",
          submitted_at: "2099-09-05T12:04:00Z",
        },
      ],
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

    const reviewBeforeRequest = runWakeupFixture({
      body: summaryBody,
      createdAt: "2099-09-05T12:01:30Z",
      updatedAt: "2099-09-05T12:03:00Z",
      comments: [requestComment("2099-09-05T12:00:00Z")],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T11:59:00Z")],
    });
    expect(reviewBeforeRequest.rerun).toBe(false);
    expect(`${reviewBeforeRequest.result.stdout}${reviewBeforeRequest.result.stderr}`).toContain(
      "CodeRabbit summary is not bound to a post-request completed current-head review",
    );

    const summaryOlderThanReview = runWakeupFixture({
      body: summaryBody,
      createdAt: "2099-09-05T12:01:00Z",
      updatedAt: "2099-09-05T12:01:30Z",
      comments: [requestComment("2099-09-05T12:00:00Z")],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
    });
    expect(summaryOlderThanReview.rerun).toBe(false);
    expect(`${summaryOlderThanReview.result.stdout}${summaryOlderThanReview.result.stderr}`).toContain(
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
    expect(completedCurrentHeadReview.result.status, completedCurrentHeadReview.result.stdout + completedCurrentHeadReview.result.stderr).toBe(0);
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

    const commentedReviewWithInlineFinding = runAutomergeFixture({
      comments: [requestComment()],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
      inlineComments: [{
        user: { login: "coderabbitai[bot]" },
        original_commit_id: reviewHead,
        commit_id: reviewHead,
        created_at: "2099-09-05T12:02:00Z",
      }],
    });
    expect(commentedReviewWithInlineFinding.stdout).not.toContain("AI_REVIEW_OK");
    expect(commentedReviewWithInlineFinding.stdout).toContain(
      "Refused: CodeRabbit posted current-head review findings; review acceptance is blocked.",
    );

    const noRequestMarkerInlineFinding = runAutomergeFixture({
      comments: [],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
      inlineComments: [{
        user: { login: "coderabbitai[bot]" },
        original_commit_id: reviewHead,
        commit_id: reviewHead,
        created_at: "2099-09-05T12:02:00Z",
      }],
    });
    expect(noRequestMarkerInlineFinding.stdout).not.toContain("AI_REVIEW_OK");
    expect(noRequestMarkerInlineFinding.stdout).toContain(
      "Refused: CodeRabbit posted current-head review findings; review acceptance is blocked.",
    );

    const reanchoredOldInlineFinding = runAutomergeFixture({
      comments: [requestComment()],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
      inlineComments: [{
        user: { login: "coderabbitai[bot]" },
        original_commit_id: oldHead,
        commit_id: reviewHead,
        created_at: "2099-09-05T12:02:00Z",
      }],
    });
    expect(reanchoredOldInlineFinding.status).toBe(0);
    expect(reanchoredOldInlineFinding.stdout).toContain("AI_REVIEW_OK");

    const preRequestInlineFinding = runAutomergeFixture({
      comments: [requestComment("2099-09-05T12:00:00Z")],
      firstReviews: [codeRabbitCompletedReview("2099-09-05T12:02:00Z")],
      inlineComments: [{
        user: { login: "coderabbitai[bot]" },
        original_commit_id: reviewHead,
        commit_id: reviewHead,
        created_at: "2099-09-05T11:59:59Z",
      }],
    });
    expect(preRequestInlineFinding.status).toBe(0);
    expect(preRequestInlineFinding.stdout).toContain("AI_REVIEW_OK");

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
    expect(wakeup).not.toContain("deferring to the review event");
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
describe("complete wakeup shell to durable adapter", () => {
  it.each(["second_clean_form", "trailing_newlines", "comment_without_review", "missing_job_head"])("executes one verified durable POST for %s", (mode) => {
    const body = mode === "second_clean_form" ? `Review completed for exact HEAD ${reviewHead}.\nI found no material findings.` : cleanBody() + (mode === "trailing_newlines" ? "\n\n" : "");
    const result = runWakeupFixture({ body, comments: [requestComment()], adapterFault: mode === "missing_job_head" ? "missing_job_head" : undefined });
    expect(result.result.status, result.result.stdout + result.result.stderr).toBe(0);
    expect(result.posts).toBe(1); expect(result.intents.map((i) => i.state)).toEqual(["ACCEPTED"]);
    const post = result.ops.findIndex((op) => op.endpoint.endsWith("/rerun"));
    expect(post).toBeGreaterThan(0);
    expect(result.ops[post].states).toEqual(["PREPARED"]);
    expect(result.ops.slice(0, post).some((op) => op.method === "GET" && op.endpoint.includes("/issues/548/comments") && op.states.includes("PREPARED"))).toBe(true);
  }, 30000);
  it.each(["blocking_review", "new_attempt", "wrong_job_head"] as const)("does not cross POST after %s", (adapterFault) => {
    const result = runWakeupFixture({ body: cleanBody(), comments: [requestComment()], adapterFault });
    expect(result.posts).toBe(0);
    expect(result.intents).toEqual([]);
    if (adapterFault !== "wrong_job_head") expect(result.result.stdout).toContain("FAIL_CLOSED_MISMATCH");
  }, 30000);
  it("retains uncertain side effects after POST response loss", () => {
    const result = runWakeupFixture({ body: cleanBody(), comments: [requestComment()], adapterFault: "post_timeout" });
    expect(result.result.status, result.result.stdout + result.result.stderr).toBe(0);
    expect(result.posts).toBe(1); expect(result.intents.map((i) => i.state)).toEqual(["UNCERTAIN"]);
  }, 30000);
  it("admits a clean Codex comment independently, but not an old comment edited after its request", () => {
    const request = { id: 50, user: { login: "ibboabdoli-ai" }, body: `<!-- proffera-codex-fallback-review-request:${reviewHead} -->\n@codex review`, created_at: "2099-09-05T12:01:00Z" };
    const base = { actor: "chatgpt-codex-connector[bot]", body: `Codex Review: Didn't find any major issues. Reviewed commit: ${reviewHead}`, comments: [requestComment(), request] };
    const fresh = runWakeupFixture(base);
    expect(fresh.result.status, fresh.result.stdout + fresh.result.stderr).toBe(0); expect(fresh.posts).toBe(1);
    const edited = runWakeupFixture({ ...base, createdAt: "2099-09-05T12:00:30Z", updatedAt: "2099-09-05T12:03:00Z" });
    expect(edited.posts).toBe(0); expect(edited.intents).toEqual([]);
  }, 30000);
  it("does not turn disabled automatic review into an outage, while recognized post-request rate limits reach the adapter", () => {
    const skipped = runWakeupFixture({ body: "Review skipped: automatic reviews are disabled", comments: [requestComment()] });
    expect(skipped.posts).toBe(0); expect(skipped.intents).toEqual([]);
    const unavailable = runWakeupFixture({ body: "Review rate limited", comments: [requestComment()] });
    expect(unavailable.result.status, unavailable.result.stdout + unavailable.result.stderr).toBe(0); expect(unavailable.posts).toBe(1);
    const stale = runWakeupFixture({ body: "Review rate limited", createdAt: "2099-09-05T11:59:00Z", comments: [requestComment()] });
    expect(stale.posts).toBe(0);
  }, 30000);
  it("routes both independently accepted CodeRabbit clean formats through the existing router", () => {
    const router = source(".github/workflows/supervisor-event-router.yml");
    const match = router.match(/grep -Eqi '(recent_review_start\|[^']+)' <<< "\$\{COMMENT_BODY:-\}"/);
    expect(match).not.toBeNull();
    for (const body of [cleanBody(), `Review completed for exact HEAD ${reviewHead}.\nI found no material findings.`]) {
      const result = spawnSync("bash", ["-c", 'grep -Eqi "$MATCH" <<< "$BODY"'], { encoding: "utf8", env: { ...process.env, MATCH: match![1], BODY: body } });
      expect(result.status).toBe(0);
    }
  });
});
