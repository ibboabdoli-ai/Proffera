import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replaceAll("\r\n", "\n");
}

const workflow = source(".github/workflows/proffera-automerge.yml");
const authorization = JSON.parse(source(".github/proffera-standing-merge-authorization.json")) as {
  enabled: boolean;
  authorized_by: string;
  scope: string;
  supervisor_issue: number;
  branch_prefixes: string[];
  expires_at: string;
  note: string;
};

function authorizationShellBlock() {
  const startMarker = '          pr_json="$(gh pr view';
  const endMarker = '          file_count="$(grep -c';
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

function finalOwnerAuthorizationShellBlock() {
  const startMarker = '          final_pr_json="$(gh pr view';
  const endMarker = '          summary "- Fresh exact-head owner authorization revalidated immediately before merge"';
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

function aiReviewShellBlock() {
  const startMarker = '          file_count="$(grep -c . <<< "$changed_files" || true)"';
  const endMarker = '          checks_json=""';
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

type AiReviewFixture = {
  reviews: Array<Record<string, unknown>>;
};

function runAiReviewFixture(fixture: AiReviewFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-review-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "review.sh");
  const headSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"/pulls/695/reviews?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_REVIEWS"
  exit 0
fi
if [[ "$args" == *"/issues/695/comments?per_page=100"* ]]; then
  printf '\\n'
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 2
`, { mode: 0o755 });
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
REPOSITORY=ibboabdoli-ai/Proffera
pr_number=695
head_sha=${headSha}
changed_files="$(printf 'src/features/example-%s.ts\\n' {1..12})"
pr_json='{"labels":[{"name":"needs-ai-review"}]}'
${aiReviewShellBlock()}
printf 'AI_REVIEW_OK\\n'
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_REVIEWS: fixture.reviews.map((item) => JSON.stringify(item)).join("\n"),
    },
  });
  rmSync(dir, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  return { output: result.stdout, headSha };
}

function finalCodeRabbitGuardShellBlock() {
  const startMarker = '          if [ "$needs_ai_review" = "true" ]; then\n            final_reviews_json=';
  const endMarker = "          # Revalidate the mandatory per-PR human authorization";
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

type FinalCodeRabbitFixture = {
  reviews: Array<Record<string, unknown>>;
};

function runFinalCodeRabbitFixture(fixture: FinalCodeRabbitFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-final-review-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "final-review.sh");
  const headSha = "cccccccccccccccccccccccccccccccccccccccc";

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"/pulls/695/reviews?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_REVIEWS"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 2
`, { mode: 0o755 });
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
REPOSITORY=ibboabdoli-ai/Proffera
pr_number=695
head_sha=${headSha}
needs_ai_review=true
${finalCodeRabbitGuardShellBlock()}
printf 'FINAL_REVIEW_OK\\n'
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_REVIEWS: fixture.reviews.map((item) => JSON.stringify(item)).join("\n"),
    },
  });
  rmSync(dir, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  return { output: result.stdout, headSha };
}

function workflowRunGateShellBlock() {
  const startMarker = '          if [ "$EVENT_NAME" = "workflow_run" ]; then';
  const endMarker = '          pr_number="${EVENT_PR_NUMBER:-}"';
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow
    .slice(start, end)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

function runWorkflowRunGateFixture(workflowName: string, conclusion: string) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-workflow-run-"));
  const script = join(dir, "workflow-run.sh");

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
EVENT_NAME=workflow_run
${workflowRunGateShellBlock()}
printf 'WORKFLOW_RUN_OK\\n'
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      EVENT_WORKFLOW_NAME: workflowName,
      EVENT_WORKFLOW_CONCLUSION: conclusion,
    },
  });
  rmSync(dir, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function parseWorkflowTriggers(yaml: string) {
  const lines = yaml.split(/\r?\n/);
  const onIndex = lines.findIndex((line) => line === "on:");
  expect(onIndex).toBeGreaterThanOrEqual(0);

  const triggers = new Map<string, { types: string[]; workflows: string[] }>();
  let currentTrigger: string | null = null;

  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length > 0 && !line.startsWith(" ")) break;

    const triggerMatch = line.match(/^  ([a-z_]+):(?:\s*\[(.*)\])?$/);
    if (triggerMatch) {
      currentTrigger = triggerMatch[1];
      triggers.set(currentTrigger, { types: [], workflows: [] });
      continue;
    }

    if (!currentTrigger) continue;
    const childMatch = line.match(/^    (types|workflows):\s*\[(.*)\]$/);
    if (!childMatch) continue;

    const values = childMatch[2]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    triggers.get(currentTrigger)![childMatch[1] as "types" | "workflows"] = values;
  }

  return triggers;
}

type AuthorizationFixture = {
  pr: Record<string, unknown>;
  policy?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  eventPages?: [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  commentPages?: [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  changedFiles?: string;
  commitMessage?: string;
};

function runAuthorizationFixture(fixture: AuthorizationFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "authorization.sh");

  const ghScript = `#!/usr/bin/env bash
set -euo pipefail
args="$*"
expected_policy_path="repos/ibboabdoli-ai/Proffera/contents/.github/proffera-standing-merge-authorization.json?ref=main"
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  printf '%s\\n' "$FAKE_PR_JSON"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then
  printf '%s' "$FAKE_CHANGED_FILES"
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "$expected_policy_path" ]; then
  printf '%s\\n' "$FAKE_POLICY_B64"
  exit 0
fi
if [ "$1" = "api" ] && [[ "$2" == *"/contents/"* ]]; then
  printf 'standing policy request did not exactly match main path: %s\\n' "$args" >&2
  exit 2
fi
if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then
  node_id=""
  for arg in "$@"; do
    case "$arg" in
      id=*) node_id="\${arg#id=}" ;;
    esac
  done
  if [ -z "$node_id" ]; then
    printf 'missing GraphQL node id\\n' >&2
    exit 2
  fi
  if [[ "$node_id" == EDITED_* ]]; then
    printf '{"data":{"node":{"__typename":"IssueComment","lastEditedAt":"2099-09-05T12:00:00Z"}}}\\n'
  elif [[ "$node_id" == GQLFAIL_* ]]; then
    printf 'graphql error\\n' >&2
    exit 1
  elif [[ "$node_id" == NULLNODE_* ]]; then
    printf '{"data":{"node":null}}\\n'
  elif [[ "$node_id" == WRONGTYPE_* ]]; then
    printf '{"data":{"node":{"__typename":"PullRequest"}}}\\n'
  else
    printf '{"data":{"node":{"__typename":"IssueComment","lastEditedAt":null}}}\\n'
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/issues/"*"/events"* ]]; then
  printf '%s\\n' "$FAKE_EVENTS_PAGE1_NDJSON"
  if [[ "$args" == *"--paginate"* ]] && [ -n "$FAKE_EVENTS_PAGE2_NDJSON" ]; then
    printf '%s\\n' "$FAKE_EVENTS_PAGE2_NDJSON"
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/issues/"*"/comments"* ]]; then
  printf '%s\\n' "$FAKE_COMMENTS_PAGE1_NDJSON"
  if [[ "$args" == *"--paginate"* ]] && [ -n "$FAKE_COMMENTS_PAGE2_NDJSON" ]; then
    printf '%s\\n' "$FAKE_COMMENTS_PAGE2_NDJSON"
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/pulls/"*"/reviews"* ]]; then
  printf '%s\\n' "$FAKE_REVIEWS_NDJSON"
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/commits/"* ]]; then
  printf '%s\\n' "$FAKE_COMMIT_JSON"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 2
`;

  writeFileSync(fakeGh, ghScript, { mode: 0o755 });
  writeFileSync(
    script,
    `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
pr_number=695
REPOSITORY=ibboabdoli-ai/Proffera
STANDING_AUTH_PATH=.github/proffera-standing-merge-authorization.json
HUMAN_APPROVER=ibboabdoli-ai
${authorizationShellBlock()}
printf 'AUTH_MODE=%s\\n' "$authorization_mode"
`,
    { mode: 0o755 },
  );

  const policy = fixture.policy ?? {
    ...authorization,
    expires_at: "2099-09-30T23:59:59Z",
  };
  const reviews = fixture.reviews ?? [];
  const eventPages = fixture.eventPages ?? [fixture.events ?? [], []];
  const commentPages = fixture.commentPages ?? [fixture.comments ?? [], []];
  const changedFiles = fixture.changedFiles ?? "src/app/page.tsx\nsrc/lib/utils.ts";
  const commitJson = {
    commit: {
      message: fixture.commitMessage ?? "Regular commit message",
    },
  };
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_PR_JSON: JSON.stringify(fixture.pr),
      FAKE_POLICY_B64: Buffer.from(JSON.stringify(policy), "utf8").toString("base64"),
      FAKE_EVENTS_PAGE1_NDJSON: eventPages[0].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_EVENTS_PAGE2_NDJSON: eventPages[1].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_COMMENTS_PAGE1_NDJSON: commentPages[0].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_COMMENTS_PAGE2_NDJSON: commentPages[1].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_REVIEWS_NDJSON: reviews.map((item) => JSON.stringify(item)).join("\n"),
      FAKE_CHANGED_FILES: changedFiles,
      FAKE_COMMIT_JSON: JSON.stringify(commitJson),
    },
  });

  rmSync(dir, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function basePr(overrides: Record<string, unknown> = {}) {
  return {
    baseRefName: "main",
    headRefName: "work/proffera-marketplace-safe-merge",
    headRefOid: "1111111111111111111111111111111111111111",
    labels: [],
    isDraft: false,
    body: "Supervisor handoff: #548",
    author: { login: "ibboabdoli-ai" },
    isCrossRepository: false,
    headRepositoryOwner: { login: "ibboabdoli-ai" },
    ...overrides,
  };
}

type PreMergeAuthorizationFixture = {
  finalEventPages?: [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  finalCommentPages?: [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
};

function runPreMergeAuthorizationFixture(fixture: PreMergeAuthorizationFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-automerge-pre-merge-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "pre-merge.sh");
  const stateDir = join(dir, "state");
  const headSha = "4444444444444444444444444444444444444444";
  const initialEvent = {
    id: 1,
    event: "labeled",
    created_at: "2099-09-05T12:00:00Z",
    label: { name: "ibbo-approved" },
    actor: { login: "ibboabdoli-ai" },
  };
  const initialComment = {
    id: 10,
    node_id: "UNEDITED_PREMERGE_INITIAL",
    user: { login: "ibboabdoli-ai" },
    created_at: "2099-09-05T12:00:00Z",
    body: `<!-- proffera-owner-approval:${headSha} -->\nIBBO-APPROVED: ${headSha}`,
  };

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
expected_policy_path="repos/ibboabdoli-ai/Proffera/contents/.github/proffera-standing-merge-authorization.json?ref=main"
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  printf '%s\\n' "$FAKE_PR_JSON"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ]; then
  printf '%s' "$FAKE_CHANGED_FILES"
  exit 0
fi
if [ "$1" = "api" ] && [ "$2" = "$expected_policy_path" ]; then
  printf '%s\\n' "$FAKE_POLICY_B64"
  exit 0
fi
if [ "$1" = "api" ] && [[ "$2" == *"/contents/"* ]]; then
  printf 'standing policy request did not exactly match main path: %s\\n' "$args" >&2
  exit 2
fi
if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then
  node_id=""
  for arg in "$@"; do
    case "$arg" in
      id=*) node_id="\${arg#id=}" ;;
    esac
  done
  if [ -z "$node_id" ]; then
    printf 'missing GraphQL node id\\n' >&2
    exit 2
  fi
  if [[ "$node_id" == EDITED_* ]]; then
    printf '{"data":{"node":{"__typename":"IssueComment","lastEditedAt":"2099-09-05T12:00:00Z"}}}\\n'
  elif [[ "$node_id" == GQLFAIL_* ]]; then
    printf 'graphql error\\n' >&2
    exit 1
  elif [[ "$node_id" == NULLNODE_* ]]; then
    printf '{"data":{"node":null}}\\n'
  elif [[ "$node_id" == WRONGTYPE_* ]]; then
    printf '{"data":{"node":{"__typename":"PullRequest"}}}\\n'
  else
    printf '{"data":{"node":{"__typename":"IssueComment","lastEditedAt":null}}}\\n'
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/issues/"*"/events"* ]]; then
  mkdir -p "$STATE_DIR"
  count=0
  [ -f "$STATE_DIR/events" ] && count="$(cat "$STATE_DIR/events")"
  count=$((count + 1))
  printf '%s' "$count" > "$STATE_DIR/events"
  if [ "$count" -eq 1 ]; then
    printf '%s\\n' "$FAKE_INITIAL_EVENTS_NDJSON"
  else
    printf '%s\\n' "$FAKE_FINAL_EVENTS_PAGE1_NDJSON"
    if [[ "$args" == *"--paginate"* ]] && [ -n "$FAKE_FINAL_EVENTS_PAGE2_NDJSON" ]; then
      printf '%s\\n' "$FAKE_FINAL_EVENTS_PAGE2_NDJSON"
    fi
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/issues/"*"/comments"* ]]; then
  mkdir -p "$STATE_DIR"
  count=0
  [ -f "$STATE_DIR/comments" ] && count="$(cat "$STATE_DIR/comments")"
  count=$((count + 1))
  printf '%s' "$count" > "$STATE_DIR/comments"
  if [ "$count" -eq 1 ]; then
    printf '%s\\n' "$FAKE_INITIAL_COMMENTS_NDJSON"
  else
    printf '%s\\n' "$FAKE_FINAL_COMMENTS_PAGE1_NDJSON"
    if [[ "$args" == *"--paginate"* ]] && [ -n "$FAKE_FINAL_COMMENTS_PAGE2_NDJSON" ]; then
      printf '%s\\n' "$FAKE_FINAL_COMMENTS_PAGE2_NDJSON"
    fi
  fi
  exit 0
fi
if [ "$1" = "api" ] && [[ "$args" == *"/commits/"* ]]; then
  printf '%s\\n' "$FAKE_COMMIT_JSON"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 2
`, { mode: 0o755 });

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
summary() { :; }
refuse() { printf 'REFUSED:%s\\n' "$1"; exit 0; }
pr_number=695
REPOSITORY=ibboabdoli-ai/Proffera
STANDING_AUTH_PATH=.github/proffera-standing-merge-authorization.json
HUMAN_APPROVER=ibboabdoli-ai
${authorizationShellBlock()}
printf 'INITIAL_AUTH_OK:%s\\n' "$authorization_mode"
${finalOwnerAuthorizationShellBlock()}
printf 'PRE_MERGE_OK\\n'
`, { mode: 0o755 });

  const pr = basePr({
    headRefName: "work/proffera-other-manual-path",
    headRefOid: headSha,
    labels: [{ name: "ibbo-approved" }],
  });
  const policy = {
    ...authorization,
    expires_at: "2099-09-30T23:59:59Z",
  };
  const finalEventPages = fixture.finalEventPages ?? [[initialEvent], []];
  const finalCommentPages = fixture.finalCommentPages ?? [[initialComment], []];
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      STATE_DIR: stateDir,
      FAKE_PR_JSON: JSON.stringify(pr),
      FAKE_POLICY_B64: Buffer.from(JSON.stringify(policy), "utf8").toString("base64"),
      FAKE_CHANGED_FILES: "src/app/page.tsx\nsrc/lib/utils.ts",
      FAKE_COMMIT_JSON: JSON.stringify({ commit: { message: "Regular commit message" } }),
      FAKE_INITIAL_EVENTS_NDJSON: JSON.stringify(initialEvent),
      FAKE_FINAL_EVENTS_PAGE1_NDJSON: finalEventPages[0].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_FINAL_EVENTS_PAGE2_NDJSON: finalEventPages[1].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_INITIAL_COMMENTS_NDJSON: JSON.stringify(initialComment),
      FAKE_FINAL_COMMENTS_PAGE1_NDJSON: finalCommentPages[0].map((item) => JSON.stringify(item)).join("\n"),
      FAKE_FINAL_COMMENTS_PAGE2_NDJSON: finalCommentPages[1].map((item) => JSON.stringify(item)).join("\n"),
    },
  });

  rmSync(dir, { recursive: true, force: true });
  expect(result.status, result.stderr).toBe(0);
  return { output: result.stdout, headSha, initialEvent, initialComment };
}

describe("Proffera standing automerge authorization", () => {
  it("keeps standing authorization scoped and time bounded", () => {
    expect(authorization.enabled).toBe(true);
    expect(authorization.authorized_by).toBe("ibboabdoli-ai");
    expect(authorization.scope).toBe("marketplace-core-loop");
    expect(authorization.supervisor_issue).toBe(548);
    expect(authorization.branch_prefixes).toContain("work/proffera-business-profile-");
    expect(authorization.branch_prefixes).toContain("work/proffera-marketplace-");
    expect(authorization.branch_prefixes).toContain("work/proffera-search-");
    expect(authorization.branch_prefixes).toContain("work/proffera-profile-");
    expect(authorization.branch_prefixes).not.toContain("work/proffera-company-directory-");
    expect(authorization.branch_prefixes).not.toContain("work/proffera-");
    expect(authorization.note).toContain("Marketplace, Business Profile, Search, and Profile");
    expect(Date.parse(authorization.expires_at)).toBeGreaterThan(Date.parse("2026-08-23T00:00:00Z"));
  });

  it("refuses standing authorization alone as actual merge authority", () => {
    const output = runAuthorizationFixture({ pr: basePr() });
    expect(output).toContain("REFUSED:");
    expect(output).toContain("standing authorization is advisory only");
    expect(output).not.toContain("AUTH_MODE=");
  });

  it("keeps a matching standing scope advisory when the PR body uses CRLF", () => {
    const output = runAuthorizationFixture({
      pr: basePr({ body: "Some text\r\nSupervisor handoff: #548\r\nMore text" }),
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=");
  });

  it("rejects an expired standing authorization", () => {
    const output = runAuthorizationFixture({
      pr: basePr(),
      policy: {
        ...authorization,
        expires_at: "2026-08-22T23:59:59Z",
      },
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });

  it("rejects a fork even when its branch and handoff match the standing policy", () => {
    const output = runAuthorizationFixture({
      pr: basePr({ isCrossRepository: true, headRepositoryOwner: { login: "attacker" } }),
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });

  it("rejects a non-owner author even when the branch is in standing scope", () => {
    const output = runAuthorizationFixture({
      pr: basePr({ author: { login: "other-user" } }),
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });

  it("excludes Codex-generated heads from standing authorization", () => {
    const output = runAuthorizationFixture({
      pr: basePr(),
      commitMessage: "[codex-autofix] Fix CI blocker for PR #695",
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });

  it("rejects manual fallback when the owner approval targets a stale head", () => {
    const currentHead = "2222222222222222222222222222222222222222";
    const staleHead = "1111111111111111111111111111111111111111";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${staleHead} -->\nIBBO-APPROVED: ${staleHead}`,
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=fresh-exact-head-owner");
  });

  it("accepts manual fallback only when owner label and approval comment target the exact current head", () => {
    const currentHead = "3333333333333333333333333333333333333333";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        node_id: "UNEDITED_INITIAL_EXACT",
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
      }],
    });
    expect(output).toContain("AUTH_MODE=fresh-exact-head-owner");
  });

  it("uses paginated event and comment history to find owner evidence on a later page", () => {
    const currentHead = "5555555555555555555555555555555555555555";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      eventPages: [
        [{
          id: 1,
          event: "unlabeled",
          created_at: "2099-09-05T11:59:00Z",
          label: { name: "other-label" },
          actor: { login: "other-user" },
        }],
        [{
          id: 2,
          event: "labeled",
          created_at: "2099-09-05T12:00:00Z",
          label: { name: "ibbo-approved" },
          actor: { login: "ibboabdoli-ai" },
        }],
      ],
      commentPages: [
        [{
          id: 9,
          user: { login: "other-user" },
          body: "not approval evidence",
        }],
        [{
          id: 10,
          node_id: "UNEDITED_INITIAL_PAGED",
          user: { login: "ibboabdoli-ai" },
          created_at: "2099-09-05T12:00:00Z",
          body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
        }],
      ],
    });
    expect(output).toContain("AUTH_MODE=fresh-exact-head-owner");
  });

  it("rejects a matching standing scope and owner label without an exact-head owner approval comment", () => {
    const output = runAuthorizationFixture({
      pr: basePr({ labels: [{ name: "ibbo-approved" }] }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=");
  });

  it("rejects bot-authored exact-head approval evidence", () => {
    const currentHead = "1111111111111111111111111111111111111111";
    const output = runAuthorizationFixture({
      pr: basePr({ labels: [{ name: "ibbo-approved" }] }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        user: { login: "github-actions[bot]" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=");
  });

  it("rejects owner approval comments that are not the exact canonical body", () => {
    const currentHead = "3333333333333333333333333333333333333333";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}\nextra text`,
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=");
  });

  it("rejects GraphQL-edited owner approval comments even when REST timestamps are equal", () => {
    const currentHead = "6666666666666666666666666666666666666666";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        id: 1,
        event: "labeled",
        created_at: "2099-09-05T12:00:00Z",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        node_id: "EDITED_INITIAL",
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        updated_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=fresh-exact-head-owner");
  });

  it.each(["GQLFAIL_INITIAL", "NULLNODE_INITIAL", "WRONGTYPE_INITIAL"])(
    "fails closed when initial owner comment edit status is unknown: %s",
    (nodeId) => {
      const currentHead = "7777777777777777777777777777777777777777";
      const output = runAuthorizationFixture({
        pr: basePr({
          headRefName: "work/proffera-other-manual-path",
          headRefOid: currentHead,
          labels: [{ name: "ibbo-approved" }],
        }),
        events: [{
          id: 1,
          event: "labeled",
          created_at: "2099-09-05T12:00:00Z",
          label: { name: "ibbo-approved" },
          actor: { login: "ibboabdoli-ai" },
        }],
        comments: [{
          node_id: nodeId,
          user: { login: "ibboabdoli-ai" },
          created_at: "2099-09-05T12:00:00Z",
          body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
        }],
      });
      expect(output).toContain("REFUSED:");
      expect(output).not.toContain("AUTH_MODE=fresh-exact-head-owner");
    },
  );

  it("keeps unchanged owner authorization valid through final revalidation", () => {
    const fixture = runPreMergeAuthorizationFixture({});
    expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
    expect(fixture.output).toContain("PRE_MERGE_OK");
    expect(fixture.output).not.toContain("REFUSED:");
  });

  it("revalidates label provenance from a later event page immediately before merge", () => {
    const fixture = runPreMergeAuthorizationFixture({
      finalEventPages: [
        [{
          id: 1,
          event: "labeled",
          created_at: "2099-09-05T12:00:00Z",
          label: { name: "ibbo-approved" },
          actor: { login: "ibboabdoli-ai" },
        }],
        [{
          id: 2,
          event: "labeled",
          created_at: "2099-09-05T12:01:00Z",
          label: { name: "ibbo-approved" },
          actor: { login: "other-user" },
        }],
      ],
    });
    expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
    expect(fixture.output).toContain("REFUSED:Refused: fresh exact-head owner authorization was removed, edited, or otherwise invalid before merge.");
    expect(fixture.output).not.toContain("PRE_MERGE_OK");
  });

  it("finds the canonical final owner approval comment on a later comment page", () => {
    const fixture = runPreMergeAuthorizationFixture({
      finalCommentPages: [
        [{
          id: 9,
          user: { login: "other-user" },
          body: "not approval evidence",
        }],
        [{
          id: 10,
          node_id: "UNEDITED_FINAL_PAGED",
          user: { login: "ibboabdoli-ai" },
          created_at: "2099-09-05T12:00:00Z",
          body: `<!-- proffera-owner-approval:${"4444444444444444444444444444444444444444"} -->\nIBBO-APPROVED: 4444444444444444444444444444444444444444`,
        }],
      ],
    });
    expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
    expect(fixture.output).toContain("PRE_MERGE_OK");
    expect(fixture.output).not.toContain("REFUSED:");
  });

  it("revalidates the canonical owner approval comment immediately before merge", () => {
    const fixture = runPreMergeAuthorizationFixture({
      finalCommentPages: [[{
        id: 10,
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${"4444444444444444444444444444444444444444"} -->\nIBBO-APPROVED: 4444444444444444444444444444444444444444\nextra text`,
      }], []],
    });
    expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
    expect(fixture.output).toContain("REFUSED:Refused: fresh exact-head owner authorization was removed, edited, or otherwise invalid before merge.");
    expect(fixture.output).not.toContain("PRE_MERGE_OK");
  });

  it("rejects a GraphQL-edited owner approval comment during final revalidation when REST timestamps are equal", () => {
    const headSha = "4444444444444444444444444444444444444444";
    const fixture = runPreMergeAuthorizationFixture({
      finalCommentPages: [[{
        id: 10,
        node_id: "EDITED_FINAL",
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        updated_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${headSha} -->\nIBBO-APPROVED: ${headSha}`,
      }], []],
    });
    expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
    expect(fixture.output).toContain("REFUSED:Refused: fresh exact-head owner authorization was removed, edited, or otherwise invalid before merge.");
    expect(fixture.output).not.toContain("PRE_MERGE_OK");
  });

  it.each(["GQLFAIL_FINAL", "NULLNODE_FINAL", "WRONGTYPE_FINAL"])(
    "fails closed when final owner comment edit status is unknown: %s",
    (nodeId) => {
      const headSha = "4444444444444444444444444444444444444444";
      const fixture = runPreMergeAuthorizationFixture({
        finalCommentPages: [[{
          id: 10,
          node_id: nodeId,
          user: { login: "ibboabdoli-ai" },
          created_at: "2099-09-05T12:00:00Z",
          body: `<!-- proffera-owner-approval:${headSha} -->\nIBBO-APPROVED: ${headSha}`,
        }], []],
      });
      expect(fixture.output).toContain("INITIAL_AUTH_OK:fresh-exact-head-owner");
      expect(fixture.output).toContain("REFUSED:Refused: fresh exact-head owner authorization was removed, edited, or otherwise invalid before merge.");
      expect(fixture.output).not.toContain("PRE_MERGE_OK");
    },
  );

  it("reads standing authorization only from main and keeps current-head safety gates", () => {
    const ci = source(".github/workflows/ci.yml");
    expect(workflow).toContain("contents/$STANDING_AUTH_PATH?ref=main");
    expect(workflow).toContain("Standing authorization advisory");
    expect(workflow).toContain("standing authorization is advisory only");
    expect(workflow).toContain('authorization_mode="fresh-exact-head-owner"');
    expect(workflow).toContain('owner_approval_marker="<!-- proffera-owner-approval:${head_sha} -->"');
    expect(workflow).toContain('owner_approval_line="IBBO-APPROVED: ${head_sha}"');
    expect(workflow).toContain('gh api --paginate "repos/$REPOSITORY/issues/$pr_number/events?per_page=100"');
    expect(workflow).toContain('gh api --paginate "repos/$REPOSITORY/issues/$pr_number/comments?per_page=100"');
    expect(workflow).not.toContain("the owner's latest APPROVED review on the exact current head");
    expect(workflow).not.toContain('authorization_mode="standing:');
    expect(workflow).toContain("needs-ai-review");
    expect(workflow).toContain("coderabbitai[bot]");
    expect(workflow).toContain("commit_id == $sha");
    expect(workflow).toContain("CodeRabbit changes remain requested on the current PR head; Codex fallback can never clear them.");
    expect(ci).toContain("Final exact-head review is complete for");
    expect(ci).toContain("I found no issues\\\\.");
    expect(ci).toContain("CodeRabbit review command invocation: v2:[0-9a-f]{64}");
    expect(workflow).toContain("coderabbit_review_completion_time");
    expect(workflow).toContain('select(.state == "APPROVED" or .state == "COMMENTED")');
    expect(workflow).toContain('select((.submitted_at // "") >= $request_time)');
    expect(workflow).toContain('select((.updated_at // .created_at // "") >= $completion_time)');
    expect(workflow).toContain("... on IssueComment { lastEditedAt }");
    expect(workflow).toContain('.data.node.__typename == "IssueComment" and .data.node.lastEditedAt == null');
    expect(workflow).toContain("count_unedited_owner_approvals() {");
    expect(workflow).toContain('owner_head_approval_count="$(count_unedited_owner_approvals "$owner_comments_json")"');
    expect(workflow).toContain('final_owner_head_approval_count="$(count_unedited_owner_approvals "$final_owner_comments_json")"');
    expect((workflow.match(/count_unedited_owner_approvals\(\) \{/g) ?? [])).toHaveLength(1);
    expect(workflow).not.toContain('(.updated_at // .created_at) == .created_at');
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain('workflows: [CI, Security review regressions]');
    expect(workflow).toContain('E2E public smoke');
    expect(workflow).toContain('select(.name == "Validate" and .bucket == "pass")');
    expect(workflow).toContain('select(.name == "E2E public smoke" and .bucket == "pass")');
    expect(workflow).toContain('the exact-head CI Validate check is missing or not successful');
    expect(workflow).toContain('the exact-head E2E public smoke Final Gate is missing or not successful');
    expect(workflow).toContain('Refused: one or more checks failed or were cancelled.');
    expect(workflow).toContain("Fresh exact-head owner authorization revalidated immediately before merge");
    expect(workflow).toContain("--match-head-commit \"$head_sha\"");
    expect(workflow).not.toMatch(/gh pr merge[^\n]*--admin/);
    expect(workflow).not.toContain("head_commit_time");
    expect(workflow).not.toContain("approval_time");
  });

  it("reacts to CI completion and review events instead of depending on polling", () => {
    const triggers = parseWorkflowTriggers(workflow);
    expect(triggers.get("workflow_run")?.workflows).toContain("CI");
    expect(triggers.get("workflow_run")?.workflows).toContain("Security review regressions");
    expect(triggers.get("workflow_run")?.types).toContain("completed");
    expect(triggers.has("pull_request_review")).toBe(false);
    expect(triggers.has("issue_comment")).toBe(false);
    expect(triggers.get("pull_request")?.types).toEqual(["labeled", "unlabeled"]);
    const router = source(".github/workflows/supervisor-event-router.yml");
    expect(router).toContain("pull_request_review:");
    expect(router).toContain("issue_comment:");
    expect(router).toContain("proffera-automerge.yml");
    expect(router).toContain("<!-- proffera-owner-approval:");
    expect(router).toContain("IBBO-APPROVED:");
  });

  it("accepts only successful CI and security-regression workflow_run wake events", () => {
    expect(runWorkflowRunGateFixture("CI", "success")).toContain("WORKFLOW_RUN_OK");
    expect(runWorkflowRunGateFixture("Security review regressions", "success")).toContain("WORKFLOW_RUN_OK");

    const untrusted = runWorkflowRunGateFixture("Untrusted workflow", "success");
    expect(untrusted).toContain("REFUSED:");
    expect(untrusted).toContain("not an allowed completion workflow");

    const failedSecurity = runWorkflowRunGateFixture("Security review regressions", "failure");
    expect(failedSecurity).toContain("REFUSED:");
    expect(failedSecurity).toContain("did not complete successfully");
  });

  it("executes current-head CodeRabbit blocking precedence in the real automerge gate", () => {
    const headSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const timestamp = "2026-08-31T10:04:00Z";
    const changes = {
      user: { login: "coderabbitai[bot]" },
      commit_id: headSha,
      state: "CHANGES_REQUESTED",
      submitted_at: timestamp,
    };

    const blocked = runAiReviewFixture({ reviews: [changes] });
    expect(blocked.output).toContain("REFUSED:Refused: CodeRabbit changes remain requested on the current PR head");

    const equalApproval = runAiReviewFixture({
      reviews: [
        changes,
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: headSha,
          state: "APPROVED",
          submitted_at: timestamp,
        },
      ],
    });
    expect(equalApproval.output).toContain("REFUSED:Refused: CodeRabbit changes remain requested on the current PR head");

    const laterApproval = runAiReviewFixture({
      reviews: [
        changes,
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: headSha,
          state: "APPROVED",
          submitted_at: "2026-08-31T10:05:00Z",
        },
      ],
    });
    expect(laterApproval.output).toContain("AI_REVIEW_OK");
  });

  it("re-checks current-head CodeRabbit immediately before merge", () => {
    const headSha = "cccccccccccccccccccccccccccccccccccccccc";
    const changes = {
      user: { login: "coderabbitai[bot]" },
      commit_id: headSha,
      state: "CHANGES_REQUESTED",
      submitted_at: "2026-08-31T21:58:00Z",
    };

    const blocked = runFinalCodeRabbitFixture({ reviews: [changes] });
    expect(blocked.output).toContain("REFUSED:Refused: CodeRabbit changes were requested on the current PR head after the earlier review gate; merge is blocked.");

    const cleared = runFinalCodeRabbitFixture({
      reviews: [
        changes,
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: headSha,
          state: "APPROVED",
          submitted_at: "2026-08-31T21:59:00Z",
        },
      ],
    });
    expect(cleared.output).toContain("FINAL_REVIEW_OK");
  });

  it("blocks sensitive control-plane and schema paths even with fresh owner authorization", () => {
    const currentHead = "1111111111111111111111111111111111111111";
    const output = runAuthorizationFixture({
      pr: basePr({ labels: [{ name: "ibbo-approved" }] }),
      events: [{
        event: "labeled",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      comments: [{
        node_id: "UNEDITED_SENSITIVE_PATH",
        user: { login: "ibboabdoli-ai" },
        created_at: "2099-09-05T12:00:00Z",
        body: `<!-- proffera-owner-approval:${currentHead} -->\nIBBO-APPROVED: ${currentHead}`,
      }],
      changedFiles: ".github/workflows/proffera-automerge.yml\nAGENTS.md\nWORKER_BOOTSTRAP.md\ndb/migrations/0059_x.sql",
    });
    expect(output).toContain("REFUSED:");
    expect(output).toContain("blocked sensitive paths");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });
});
