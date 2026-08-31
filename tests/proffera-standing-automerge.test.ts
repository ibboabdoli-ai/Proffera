import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
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
  const endMarker = '          merge_output="$(gh pr merge';
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
if [ "$1" = "api" ] && [[ "$args" == *"/issues/"*"/events"* ]]; then
  printf '%s\\n' "$FAKE_EVENTS_JSON"
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
      FAKE_EVENTS_JSON: JSON.stringify(fixture.events ?? []),
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

  it("executes the standing-authorization branch for a trusted same-repository owner PR", () => {
    expect(runAuthorizationFixture({ pr: basePr() })).toContain("AUTH_MODE=standing:marketplace-core-loop");
  });

  it("handles CRLF line endings in PR body handoff line", () => {
    const output = runAuthorizationFixture({
      pr: basePr({ body: "Some text\r\nSupervisor handoff: #548\r\nMore text" }),
    });
    expect(output).toContain("AUTH_MODE=standing:marketplace-core-loop");
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
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        event: "labeled",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      reviews: [{
        user: { login: "ibboabdoli-ai" },
        state: "APPROVED",
        commit_id: "1111111111111111111111111111111111111111",
      }],
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=fresh-owner-label");
  });

  it("accepts manual fallback only when owner label and approval target the exact current head", () => {
    const currentHead = "3333333333333333333333333333333333333333";
    const output = runAuthorizationFixture({
      pr: basePr({
        headRefName: "work/proffera-other-manual-path",
        headRefOid: currentHead,
        labels: [{ name: "ibbo-approved" }],
      }),
      events: [{
        event: "labeled",
        label: { name: "ibbo-approved" },
        actor: { login: "ibboabdoli-ai" },
      }],
      reviews: [{
        user: { login: "ibboabdoli-ai" },
        state: "APPROVED",
        commit_id: currentHead,
      }],
    });
    expect(output).toContain("AUTH_MODE=fresh-owner-label");
  });

  it("reads standing authorization only from main and keeps current-head safety gates", () => {
    expect(workflow).toContain("contents/$STANDING_AUTH_PATH?ref=main");
    expect(workflow).toContain("needs-ai-review");
    expect(workflow).toContain("coderabbitai[bot]");
    expect(workflow).toContain("commit_id == $sha");
    expect(workflow).toContain("CodeRabbit changes remain requested on the current PR head; Codex fallback can never clear them.");
    expect(workflow).toContain("--match-head-commit \"$head_sha\"");
    expect(workflow).not.toContain("head_commit_time");
    expect(workflow).not.toContain("approval_time");
  });

  it("reacts to CI completion and review events instead of depending on polling", () => {
    const triggers = parseWorkflowTriggers(workflow);
    expect(triggers.get("workflow_run")?.workflows).toContain("CI");
    expect(triggers.get("workflow_run")?.types).toContain("completed");
    expect(triggers.has("pull_request_review")).toBe(true);
    expect(triggers.has("issue_comment")).toBe(true);
    expect(triggers.get("pull_request")?.types).toContain("ready_for_review");
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

  it("blocks sensitive control-plane and schema paths from standing authorization", () => {
    const output = runAuthorizationFixture({
      pr: basePr(),
      changedFiles: ".github/workflows/proffera-automerge.yml\nAGENTS.md\nWORKER_BOOTSTRAP.md\ndb/migrations/0059_x.sql",
    });
    expect(output).toContain("REFUSED:");
    expect(output).not.toContain("AUTH_MODE=standing:");
  });
});