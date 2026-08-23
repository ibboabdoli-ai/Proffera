import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Proffera standing automerge authorization", () => {
  const workflow = source(".github/workflows/proffera-automerge.yml");
  const authorization = JSON.parse(source(".github/proffera-standing-merge-authorization.json")) as {
    enabled: boolean;
    authorized_by: string;
    scope: string;
    supervisor_issue: number;
    branch_prefixes: string[];
    expires_at: string;
  };

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
    expect(Date.parse(authorization.expires_at)).toBeGreaterThan(Date.parse("2026-08-23T00:00:00Z"));
  });

  it("reads standing authorization only from main and restricts it to trusted same-repository owner PRs", () => {
    expect(workflow).toContain("contents/$STANDING_AUTH_PATH?ref=main");
    expect(workflow).toContain("author,isCrossRepository,headRepositoryOwner");
    expect(workflow).toContain('pr_author="$(jq -r');
    expect(workflow).toContain('is_cross_repo="$(jq -r');
    expect(workflow).toContain('head_repo_owner="$(jq -r');
    expect(workflow).toContain('[ "$pr_author" = "$HUMAN_APPROVER" ]');
    expect(workflow).toContain('[ "$is_cross_repo" = "false" ]');
    expect(workflow).toContain('[ "$head_repo_owner" = "$HUMAN_APPROVER" ]');
    expect(workflow).toContain("standing_origin_match");
    expect(workflow).toContain("authorization_mode=\"standing:${standing_scope}\"");
  });

  it("keeps manual authorization tied to an owner approval of the exact current head instead of timestamps", () => {
    expect(workflow).toContain("authorization_mode=\"fresh-owner-label\"");
    expect(workflow).toContain("approval_actor");
    expect(workflow).toContain("owner_head_approval_count");
    expect(workflow).toContain('.user.login == $owner and .state == "APPROVED" and .commit_id == $sha');
    expect(workflow).not.toContain("head_commit_time");
    expect(workflow).not.toContain("approval_time");
  });

  it("never lets standing authorization bypass sensitive-path, current-head review, or head-SHA safety", () => {
    expect(workflow).toContain(".github/proffera-standing-merge-authorization.json");
    expect(workflow).toContain(".github/workflows/*");
    expect(workflow).toContain("db/migrations/*");
    expect(workflow).toContain("src/app/api/*");
    expect(workflow).toContain("needs-ai-review");
    expect(workflow).toContain("coderabbitai[bot]");
    expect(workflow).toContain("commit_id == $sha");
    expect(workflow).toContain("only a later APPROVED review clears them");
    expect(workflow).toContain("--match-head-commit \"$head_sha\"");
  });

  it("reacts to CI completion and review events instead of depending on polling", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows: [CI]");
    expect(workflow).toContain("pull_request_review:");
    expect(workflow).toContain("issue_comment:");
    expect(workflow).toContain("ready_for_review");
  });
});
