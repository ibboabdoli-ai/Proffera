from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


ci_path = Path(".github/workflows/ci.yml")
ci = ci_path.read_text()
old_case = ".github/workflows/*|db/migrations/*|migrations/*|src/app/api/*|src/app/privacy/*|src/app/privacy/**|src/app/admin/foretag/directory/*|src/app/admin/foretag/directory/**|package.json|package-lock.json|vercel.json|next.config.*|src/proxy.*|middleware.*|scripts/company-directory-discovery.py)"
new_case = ".github/workflows/*|db/migrations/*|migrations/*|src/app/api/*|src/app/privacy/*|src/app/privacy/**|*/privacy/*|src/app/admin/foretag/directory/*|src/app/admin/foretag/directory/**|package.json|package-lock.json|pnpm-lock.yaml|yarn.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock|vercel.json|next.config.*|src/proxy.*|middleware.*|scripts/company-directory-discovery.py)"
ci = replace_exact(ci, old_case, new_case, 2, "CI sensitive classifiers")
old_guard = 'if [ -n "$guard_latest_changes" ] && { [ -z "$guard_latest_approval" ] || [[ "$guard_latest_approval" < "$guard_latest_changes" ]]; }; then'
new_guard = 'if [ -n "$guard_latest_changes" ] && { [ -z "$guard_latest_approval" ] || [[ ! "$guard_latest_approval" > "$guard_latest_changes" ]]; }; then'
ci = replace_exact(ci, old_guard, new_guard, 1, "CI strict-later guard")
ci_path.write_text(ci)

automerge_path = Path(".github/workflows/proffera-automerge.yml")
automerge = automerge_path.read_text()
automerge = replace_exact(automerge, old_case, new_case, 1, "automerge fallback classifier")
automerge_path.write_text(automerge)

agents_path = Path("AGENTS.md")
agents = agents_path.read_text()
old_agents = "- A current-head CodeRabbit `CHANGES_REQUESTED` decision is always blocking. Codex can never override it; only a later current-head CodeRabbit `APPROVED` decision or a fresh authorized human policy decision may clear that state."
new_agents = "- A current-head CodeRabbit `CHANGES_REQUESTED` decision is always blocking. Codex can never override it; only a later current-head CodeRabbit `APPROVED` decision may clear that state."
agents = replace_exact(agents, old_agents, new_agents, 1, "AGENTS blocking policy")
agents_path.write_text(agents)

tooling_path = Path("tests/tooling-safety-contract.test.ts")
tooling = tooling_path.read_text()
tooling = replace_exact(
    tooling,
    'import { readFileSync } from "node:fs";\nimport { resolve } from "node:path";',
    'import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";\nimport { tmpdir } from "node:os";\nimport { delimiter, join, resolve } from "node:path";',
    1,
    "tooling imports",
)
helper_anchor = 'describe("tooling safety contract", () => {'
if tooling.count(helper_anchor) != 1:
    raise SystemExit("tooling describe anchor not unique")
ci_helper = r'''
const reviewHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function ciReviewGateShellBlock() {
  const ci = source(".github/workflows/ci.yml");
  const marker = "          changed_files=\"$(gh api --paginate \"repos/${REPOSITORY}/pulls/${PR_NUMBER}/files?per_page=100\" --jq '.[].filename')\"";
  const first = ci.indexOf(marker);
  const start = ci.indexOf(marker, first + marker.length);
  const refusalMarker = '          if [ "$fallback_eligible" = "true" ]; then\n            echo "Refused: no acceptable CodeRabbit or Codex fallback decision was recorded for the current head within the gate window."';
  const refusal = ci.indexOf(refusalMarker, start);
  const exitIndex = ci.indexOf("          exit 1", refusal);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(start).toBeGreaterThan(first);
  expect(refusal).toBeGreaterThan(start);
  expect(exitIndex).toBeGreaterThan(refusal);

  return ci
    .slice(start, exitIndex + "          exit 1".length)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");
}

type CiReviewFixture = {
  changedFiles: string;
  firstReviews?: Array<Record<string, unknown>>;
  laterReviews?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  reactions?: Array<Record<string, unknown>>;
  inlineComments?: Array<Record<string, unknown>>;
  failOnPost?: boolean;
};

function toNdjson(items: Array<Record<string, unknown>> = []) {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

function runCiReviewFixture(fixture: CiReviewFixture) {
  const dir = mkdtempSync(join(tmpdir(), "proffera-ci-review-"));
  const fakeGh = join(dir, "gh");
  const fakeSleep = join(dir, "sleep");
  const script = join(dir, "review-gate.sh");
  const stateFile = join(dir, "reviews-count");

  writeFileSync(fakeGh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"/pulls/801/files?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_CHANGED_FILES"
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
if [[ "$args" == *"/issues/801/comments?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_COMMENTS"
  exit 0
fi
if [[ "$args" == *"/issues/comments/42/reactions?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_REACTIONS"
  exit 0
fi
if [[ "$args" == *"/pulls/801/comments?per_page=100"* ]]; then
  printf '%s\\n' "$FAKE_INLINE_COMMENTS"
  exit 0
fi
if [ "$1" = "api" ] && [ "${2:-}" = "repos/ibboabdoli-ai/Proffera/pulls/801" ]; then
  if [[ "$args" == *"--jq .head.sha"* ]]; then
    printf '%s\\n' "$FAKE_HEAD_SHA"
  else
    printf '{"head":{"sha":"%s"},"labels":[{"name":"needs-ai-review"}]}\\n' "$FAKE_HEAD_SHA"
  fi
  exit 0
fi
if [[ "$args" == *"--method POST"* ]]; then
  if [ "$FAIL_ON_POST" = "true" ]; then
    printf 'unexpected POST: %s\\n' "$args" >&2
    exit 90
  fi
  printf '{"id":42,"created_at":"2026-08-31T10:02:00Z"}\\n'
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$args" >&2
exit 91
`, { mode: 0o755 });
  writeFileSync(fakeSleep, "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
REPOSITORY=ibboabdoli-ai/Proffera
PR_NUMBER=801
HEAD_SHA=${reviewHead}
pr_json='{"head":{"sha":"${reviewHead}"},"labels":[{"name":"needs-ai-review"}]}'
${ciReviewGateShellBlock()}
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_CHANGED_FILES: fixture.changedFiles,
      FAKE_FIRST_REVIEWS: toNdjson(fixture.firstReviews),
      FAKE_LATER_REVIEWS: toNdjson(fixture.laterReviews ?? fixture.firstReviews),
      FAKE_COMMENTS: toNdjson(fixture.comments),
      FAKE_REACTIONS: toNdjson(fixture.reactions),
      FAKE_INLINE_COMMENTS: toNdjson(fixture.inlineComments),
      FAKE_HEAD_SHA: reviewHead,
      FAKE_REVIEW_STATE: stateFile,
      FAIL_ON_POST: fixture.failOnPost ? "true" : "false",
    },
  });

  rmSync(dir, { recursive: true, force: true });
  return result;
}

function fallbackComments() {
  return [
    {
      id: 10,
      user: { login: "github-actions[bot]" },
      body: `<!-- proffera-coderabbit-final-review-request:${reviewHead} -->`,
      created_at: "2026-08-31T10:00:00Z",
    },
    {
      id: 11,
      user: { login: "coderabbitai[bot]" },
      body: "Review rate limited",
      created_at: "2026-08-31T10:01:00Z",
      updated_at: "2026-08-31T10:01:00Z",
    },
    {
      id: 42,
      user: { login: "github-actions[bot]" },
      body: `<!-- proffera-codex-fallback-review-request:${reviewHead} -->\n@codex review`,
      created_at: "2026-08-31T10:02:00Z",
    },
  ];
}

function largeSafeChange() {
  return Array.from({ length: 12 }, (_, index) => `src/features/example-${index}.ts`).join("\n");
}

'''
tooling = tooling.replace(helper_anchor, ci_helper + helper_anchor)

tests_anchor = '  it("keeps Codex fallback availability-only, medium-risk, exact-head, and fail-closed", () => {'
if tooling.count(tests_anchor) != 1:
    raise SystemExit("tooling Codex test anchor not unique")
runtime_tests = r'''  it("executes Codex fallback freshness and fail-closed paths against the real CI gate", () => {
    const staleReaction = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      reactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T10:01:30Z",
      }],
    });
    expect(staleReaction.status).toBe(1);
    expect(`${staleReaction.stdout}${staleReaction.stderr}`).toContain("Codex fallback has not recorded a clean current-head result yet.");

    const staleApproval = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      firstReviews: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        commit_id: reviewHead,
        state: "APPROVED",
        submitted_at: "2026-08-31T10:01:30Z",
      }],
    });
    expect(staleApproval.status).toBe(1);

    const inlineFinding = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      reactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T10:03:00Z",
      }],
      inlineComments: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        commit_id: reviewHead,
        created_at: "2026-08-31T10:03:00Z",
      }],
    });
    expect(inlineFinding.status).toBe(1);
    expect(`${inlineFinding.stdout}${inlineFinding.stderr}`).toContain("Codex fallback posted current-head review findings");

    const codeRabbitChanges = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      firstReviews: [{
        user: { login: "coderabbitai[bot]" },
        commit_id: reviewHead,
        state: "CHANGES_REQUESTED",
        submitted_at: "2026-08-31T10:03:00Z",
      }],
    });
    expect(codeRabbitChanges.status).toBe(1);
    expect(`${codeRabbitChanges.stdout}${codeRabbitChanges.stderr}`).toContain("CodeRabbit changes remain requested for current head");

    const sensitivePath = runCiReviewFixture({
      changedFiles: `${largeSafeChange()}\nsrc/app/en/privacy/page.tsx\ne2e/package-lock.json`,
      failOnPost: true,
    });
    expect(sensitivePath.status).toBe(1);
    expect(`${sensitivePath.stdout}${sensitivePath.stderr}`).toContain("this high-risk path is CodeRabbit-only");
  });

  it("fails closed when CodeRabbit approval and change request have equal timestamps during fallback", () => {
    const equalTimestamp = "2026-08-31T10:04:00Z";
    const result = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      reactions: [{
        user: { login: "chatgpt-codex-connector[bot]" },
        content: "+1",
        created_at: "2026-08-31T10:03:00Z",
      }],
      firstReviews: [],
      laterReviews: [
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: reviewHead,
          state: "CHANGES_REQUESTED",
          submitted_at: equalTimestamp,
        },
        {
          user: { login: "coderabbitai[bot]" },
          commit_id: reviewHead,
          state: "APPROVED",
          submitted_at: equalTimestamp,
        },
      ],
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("CodeRabbit changes were recorded while Codex fallback was running");
  });

'''
tooling = tooling.replace(tests_anchor, runtime_tests + tests_anchor)
tooling = tooling.replace(
    'expect(ci).toContain("src/app/privacy/*|src/app/privacy/**|src/app/admin/foretag/directory/*|src/app/admin/foretag/directory/**");',
    'expect(ci).toContain("src/app/privacy/*|src/app/privacy/**|*/privacy/*");\n    expect(ci).toContain("package-lock.json|pnpm-lock.yaml|yarn.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock");',
)
tooling = tooling.replace(
    'expect(automerge).toContain("src/app/privacy/*|src/app/privacy/**|src/app/admin/foretag/directory/*|src/app/admin/foretag/directory/**");',
    'expect(automerge).toContain("src/app/privacy/*|src/app/privacy/**|*/privacy/*");\n    expect(automerge).toContain("package-lock.json|pnpm-lock.yaml|yarn.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock");',
)
tooling_path.write_text(tooling)

standing_path = Path("tests/proffera-standing-automerge.test.ts")
standing = standing_path.read_text()
standing_helper_anchor = 'function parseWorkflowTriggers(yaml: string) {'
if standing.count(standing_helper_anchor) != 1:
    raise SystemExit("standing helper anchor not unique")
standing_helper = r'''
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

'''
standing = standing.replace(standing_helper_anchor, standing_helper + standing_helper_anchor)
final_anchor = '  it("blocks sensitive control-plane and schema paths from standing authorization", () => {'
if standing.count(final_anchor) != 1:
    raise SystemExit("standing test anchor not unique")
standing_tests = r'''  it("executes current-head CodeRabbit blocking precedence in the real automerge gate", () => {
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

'''
standing = standing.replace(final_anchor, standing_tests + final_anchor)
standing_path.write_text(standing)
