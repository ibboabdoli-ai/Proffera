from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


workflow_path = Path(".github/workflows/proffera-automerge.yml")
workflow = workflow_path.read_text()
merge_anchor = '          merge_output="$(gh pr merge "$pr_number" --repo "$REPOSITORY" --squash --delete-branch --match-head-commit "$head_sha" 2>&1)"'
guard = '''          if [ "$needs_ai_review" = "true" ]; then
            final_reviews_json="$(gh api --paginate "repos/$REPOSITORY/pulls/$pr_number/reviews?per_page=100" --jq '.[]' | jq -s '.')"
            final_current_reviews="$(jq -c --arg sha "$head_sha" '[.[] | select(.user.login == "coderabbitai[bot]" and .commit_id == $sha)]' <<< "$final_reviews_json")"
            final_latest_changes="$(jq -r '[.[] | select(.state == "CHANGES_REQUESTED") | .submitted_at] | max // empty' <<< "$final_current_reviews")"
            final_latest_approval="$(jq -r '[.[] | select(.state == "APPROVED") | .submitted_at] | max // empty' <<< "$final_current_reviews")"

            if [ -n "$final_latest_changes" ] && { [ -z "$final_latest_approval" ] || [[ ! "$final_latest_approval" > "$final_latest_changes" ]]; }; then
              refuse "Refused: CodeRabbit changes were requested on the current PR head after the earlier review gate; merge is blocked."
            fi
          fi

'''
if "final_reviews_json=" not in workflow:
    workflow = replace_exact(workflow, merge_anchor, guard + merge_anchor, 1, "final merge anchor")
workflow_path.write_text(workflow)


test_path = Path("tests/proffera-standing-automerge.test.ts")
test = test_path.read_text()
helper_anchor = "function parseWorkflowTriggers(yaml: string) {"
helper = r'''function finalCodeRabbitGuardShellBlock() {
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

'''
if "function finalCodeRabbitGuardShellBlock()" not in test:
    test = replace_exact(test, helper_anchor, helper + helper_anchor, 1, "test helper anchor")

runtime_anchor = '  it("blocks sensitive control-plane and schema paths from standing authorization", () => {'
runtime_test = r'''  it("re-checks current-head CodeRabbit immediately before merge", () => {
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

'''
if 'it("re-checks current-head CodeRabbit immediately before merge"' not in test:
    test = replace_exact(test, runtime_anchor, runtime_test + runtime_anchor, 1, "runtime test anchor")

test_path.write_text(test)
