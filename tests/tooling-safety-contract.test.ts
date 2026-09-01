import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function runSonarValidation(overrides: Record<string, string>) {
  return spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/validate-sonarqube-config.mjs")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SONAR_TOKEN: "test-token",
        SONAR_PROJECT_KEY: "test-project",
        SONAR_HOST_URL: "",
        SONAR_ORGANIZATION: "",
        ...overrides,
      },
    },
  );
}


const reviewHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function ciReviewGateShellBlock() {
  const ci = source(".github/workflows/ci.yml");
  const gateStart = ci.indexOf("  e2e_public_smoke:\n");
  const marker = "          changed_files=\"$(gh api --paginate \"repos/${REPOSITORY}/pulls/${PR_NUMBER}/files?per_page=100\" --jq '.[] | .filename, (.previous_filename // empty)')\"";
  const start = ci.indexOf(marker, gateStart);
  const refusalMarker = '          if [ "$fallback_eligible" = "true" ]; then\n            echo "Refused: no acceptable CodeRabbit or Codex fallback decision was recorded for the current head within the gate window."';
  const refusal = ci.indexOf(refusalMarker, start);
  const exitIndex = ci.indexOf("          exit 1", refusal);
  expect(gateStart).toBeGreaterThanOrEqual(0);
  expect(start).toBeGreaterThan(gateStart);
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
  reportedFileCount?: number;
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
if [ "$1" = "api" ] && [ "\${2:-}" = "repos/ibboabdoli-ai/Proffera/pulls/801" ]; then
  if [[ "$args" == *"--jq .head.sha"* ]]; then
    printf '%s\\n' "$FAKE_HEAD_SHA"
  else
    printf '{"head":{"sha":"%s"},"changed_files":%s,"labels":[{"name":"needs-ai-review"}]}\\n' "$FAKE_HEAD_SHA" "$FAKE_REPORTED_FILE_COUNT"
  fi
  exit 0
fi
if [[ "$args" == *"--method POST"* || "$args" == *"-X POST"* ]]; then
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
pr_json="$(printf '{\"head\":{\"sha\":\"%s\"},\"changed_files\":%s,\"labels\":[{\"name\":\"needs-ai-review\"}]}' "$HEAD_SHA" "$FAKE_REPORTED_FILE_COUNT")"
${ciReviewGateShellBlock()}
`, { mode: 0o755 });

  const reportedFileCount = fixture.reportedFileCount ?? fixture.changedFiles.split("\n").filter(Boolean).length;
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_CHANGED_FILES: fixture.changedFiles,
      FAKE_REPORTED_FILE_COUNT: String(reportedFileCount),
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

function codeRabbitRequestComments() {
  return [
    {
      id: 10,
      user: { login: "github-actions[bot]" },
      body: `<!-- proffera-coderabbit-final-review-request:${reviewHead} -->`,
      created_at: "2026-08-31T10:00:00Z",
    },
  ];
}

function fallbackComments() {
  return [
    ...codeRabbitRequestComments(),
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

function cleanCodexReaction() {
  return [{
    user: { login: "chatgpt-codex-connector[bot]" },
    content: "+1",
    created_at: "2026-08-31T10:03:00Z",
  }];
}

function largeSafeChange() {
  return Array.from({ length: 12 }, (_, index) => `src/features/example-${index}.ts`).join("\n");
}

describe("tooling safety contract", () => {
  it("enforces the pinned Graphify release even when graphify is already installed", () => {
    const skill = source(".codex/skills/graphify/SKILL.md");

    expect(skill).toContain('GRAPHIFY_VERSION="0.9.42"');
    expect(skill).toContain("graphify --version 2>&1 | grep -Eq");
    expect(skill).toContain('uv tool install --force "graphifyy==$GRAPHIFY_VERSION"');
    expect(skill).toContain('python3 -m pip install --upgrade "graphifyy==$GRAPHIFY_VERSION"');
    expect(skill).toContain("the active graphify executable does not match");
    expect(skill).toContain("exit 1");
  });

  it("pins GitHub Actions to immutable commit SHAs", () => {
    const ci = source(".github/workflows/ci.yml");
    const codeql = source(".github/workflows/codeql.yml");
    const sonar = source(".github/workflows/sonarqube.yml");

    expect(ci).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(ci).toMatch(/actions\/setup-node@[0-9a-f]{40} # v7/);
    expect(ci).not.toMatch(/actions\/(checkout|setup-node)@v\d+/);

    expect(codeql).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    expect(codeql).toMatch(/github\/codeql-action\/init@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/autobuild@[0-9a-f]{40} # v4/);
    expect(codeql).toMatch(/github\/codeql-action\/analyze@[0-9a-f]{40} # v4/);
    expect(codeql).not.toMatch(/github\/codeql-action\/(init|autobuild|analyze)@v\d+/);

    expect(sonar).toMatch(/actions\/checkout@[0-9a-f]{40} # v7/);
    const sonarActionRefs = [
      ...sonar.matchAll(/uses:\s*SonarSource\/sonarqube-scan-action@([^\s#]+)/g),
    ].map((match) => match[1]);
    expect(sonarActionRefs.length).toBeGreaterThan(0);
    for (const ref of sonarActionRefs) {
      expect(ref).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(sonar).not.toMatch(/SonarSource\/sonarqube-scan-action@v\d+/);
  });

  it("keeps SonarQube opt-in, credential-safe, and advisory", () => {
    const sonar = source(".github/workflows/sonarqube.yml");
    const project = source("sonar-project.properties");

    expect(sonar).toContain("vars.SONARQUBE_ENABLED == 'true'");
    expect(sonar).toContain("github.actor != 'dependabot[bot]'");
    expect(sonar).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(sonar).toContain("secrets.SONAR_TOKEN");
    expect(sonar).toContain("vars.SONAR_PROJECT_KEY");
    expect(sonar).toContain("vars.SONAR_HOST_URL");
    expect(sonar).toContain("vars.SONAR_ORGANIZATION");
    expect(sonar).toContain("fetch-depth: 0");
    expect(sonar).toContain("persist-credentials: false");
    expect(sonar).toContain("-Dsonar.qualitygate.wait=false");
    expect(sonar).toContain("node scripts/validate-sonarqube-config.mjs");
    expect(sonar).not.toContain("SONAR_TOKEN=");

    expect(project).toContain("sonar.sources=src,scripts");
    expect(project).toContain("sonar.tests=tests,e2e/tests");
    expect(project).toContain("graphify-out/**");
    expect(project).not.toContain("SONAR_TOKEN");
  });

  it("accepts exactly one SonarQube deployment mode and fails closed otherwise", () => {
    const serverOnly = runSonarValidation({ SONAR_HOST_URL: "https://sonar.example.com" });
    expect(serverOnly.status).toBe(0);

    const cloudOnly = runSonarValidation({ SONAR_ORGANIZATION: "proffera" });
    expect(cloudOnly.status).toBe(0);

    const neither = runSonarValidation({});
    expect(neither.status).toBe(1);
    expect(neither.stderr).toContain("configure SONAR_HOST_URL for SonarQube Server or SONAR_ORGANIZATION for SonarQube Cloud");

    const both = runSonarValidation({
      SONAR_HOST_URL: "https://sonar.example.com",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(both.status).toBe(1);
    expect(both.stderr).toContain("configure either SonarQube Server or SonarQube Cloud mode, not both");

    const missingToken = runSonarValidation({
      SONAR_TOKEN: "",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(missingToken.status).toBe(1);
    expect(missingToken.stderr).toContain("SONAR_TOKEN is required when SONARQUBE_ENABLED=true");

    const missingProjectKey = runSonarValidation({
      SONAR_PROJECT_KEY: "",
      SONAR_ORGANIZATION: "proffera",
    });
    expect(missingProjectKey.status).toBe(1);
    expect(missingProjectKey.stderr).toContain("SONAR_PROJECT_KEY is required when SONARQUBE_ENABLED=true");

    for (const result of [serverOnly, cloudOnly, neither, both, missingToken, missingProjectKey]) {
      expect(`${result.stdout}${result.stderr}`).not.toContain("test-token");
    }
  });

  it("keeps Playwright off known production hosts and aligns local navigation with its dev server", () => {
    const config = source("e2e/playwright.config.mjs");

    expect(config).toContain('"chat.proffera.se"');
    expect(config).toContain("Local Playwright targets must include an explicit port.");
    expect(config).toContain("const localServerUrl = parsedBaseUrl.origin;");
    expect(config).toContain("--hostname ${localServerHost} --port ${localServerPort}");
    expect(config).toContain("url: localServerUrl");
    expect(config).not.toContain("url: localBaseUrl");
  });

  it("executes Codex fallback freshness and fail-closed paths against the real CI gate", () => {
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
      reactions: cleanCodexReaction(),
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

    const sensitiveOutage = runCiReviewFixture({
      changedFiles: `${largeSafeChange()}\nsrc/app/en/privacy/page.tsx\ne2e/package-lock.json`,
      comments: fallbackComments(),
      reactions: cleanCodexReaction(),
    });
    expect(sensitiveOutage.status).toBe(0);
    expect(`${sensitiveOutage.stdout}${sensitiveOutage.stderr}`).toContain("emergency exact-head Codex fallback is allowed for this high-risk PR");
    expect(`${sensitiveOutage.stdout}${sensitiveOutage.stderr}`).toContain("Codex fallback completed clean for the current unchanged head");

    const sensitiveTimeout = runCiReviewFixture({
      changedFiles: `${largeSafeChange()}\nsrc/app/en/privacy/page.tsx`,
      comments: codeRabbitRequestComments(),
      reactions: cleanCodexReaction(),
    });
    expect(sensitiveTimeout.status).toBe(0);
    expect(`${sensitiveTimeout.stdout}${sensitiveTimeout.stderr}`).toContain("CodeRabbit high-risk availability timeout reached");
    expect(`${sensitiveTimeout.stdout}${sensitiveTimeout.stderr}`).toContain("Codex fallback completed clean for the current unchanged head");

    const sensitiveNoDecision = runCiReviewFixture({
      changedFiles: `${largeSafeChange()}\nsrc/app/en/privacy/page.tsx`,
      comments: codeRabbitRequestComments(),
    });
    expect(sensitiveNoDecision.status).toBe(1);
    expect(`${sensitiveNoDecision.stdout}${sensitiveNoDecision.stderr}`).toContain("Refused: no acceptable CodeRabbit or Codex fallback decision was recorded for the current head within the gate window.");

    const truncatedLargePr = runCiReviewFixture({
      changedFiles: "docs/readme.md",
      reportedFileCount: 3001,
      comments: fallbackComments(),
      reactions: cleanCodexReaction(),
    });
    expect(truncatedLargePr.status).toBe(0);
    expect(`${truncatedLargePr.stdout}${truncatedLargePr.stderr}`).toContain("exceeds GitHub's 3000-file API limit");
    expect(`${truncatedLargePr.stdout}${truncatedLargePr.stderr}`).toContain("emergency exact-head Codex fallback is allowed for this high-risk PR");
  }, 15000);

  it("re-checks CodeRabbit state after Codex fallback and fails closed on equal-timestamp review races", () => {
    const equalTimestamp = "2026-08-31T10:04:00Z";
    const result = runCiReviewFixture({
      changedFiles: largeSafeChange(),
      comments: fallbackComments(),
      reactions: cleanCodexReaction(),
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

  it("keeps Codex fallback availability-only, medium-risk, exact-head, and fail-closed", () => {
    const ci = source(".github/workflows/ci.yml");
    const shadow = source(".github/workflows/ci-scope-shadow.yml");
    const automerge = source(".github/workflows/proffera-automerge.yml");
    const agents = source("AGENTS.md");
    const routeStart = ci.indexOf("  route_ai_review:\n");
    const routeEnd = ci.indexOf("  e2e_public_smoke_run:\n", routeStart);
    const gateStart = ci.indexOf("  e2e_public_smoke:\n");
    const routeBlock = ci.slice(routeStart, routeEnd);
    const gateBlock = ci.slice(gateStart);

    expect(ci).toContain("fallback_eligible=true");
    expect(ci).toContain("fallback_eligible=false");
    expect(ci).toContain("proffera-codex-fallback-review-request:${HEAD_SHA}");
    expect(ci).toContain("@codex review");
    expect(ci).toContain("chatgpt-codex-connector[bot]");
    expect(ci).toContain("CodeRabbit changes remain requested for current head; Codex fallback cannot clear them.");
    expect(ci).toContain("CodeRabbit availability timeout reached; Codex fallback is allowed for this medium-risk PR.");
    expect(ci).toContain("src/app/privacy/*|src/app/privacy/**|*/privacy/*");
    expect(ci).toContain("package-lock.json|pnpm-lock.yaml|yarn.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock");
    expect(ci).toContain("issues/comments/${codex_request_id}/reactions?per_page=100");
    expect(ci).not.toContain("issues/${PR_NUMBER}/reactions?per_page=100");
    expect(ci).toContain("Checkout trusted base planner");
    expect(routeBlock).toContain(".filename, (.previous_filename // empty)");
    expect(gateBlock).toContain(".filename, (.previous_filename // empty)");
    expect(routeBlock).toContain("3000-file API limit");
    expect(gateBlock).toContain("3000-file API limit");
    expect(ci).toContain("Refused: no acceptable CodeRabbit or Codex fallback decision was recorded for the current head within the gate window.");

    expect(shadow).toContain(".policyVersion >= 2");
    expect(shadow).toContain("unsupported schema");
    expect(shadow).toContain("3000-file API limit");

    expect(automerge).toContain("fallback_eligible=true");
    expect(automerge).toContain("fallback_eligible=false");
    expect(automerge).toContain("proffera-codex-fallback-review-request:${head_sha}");
    expect(automerge).toContain("issues/comments/${codex_request_id}/reactions?per_page=100");
    expect(automerge).toContain("Current-head Codex fallback decision: clean review after CodeRabbit availability failure");
    expect(automerge).toContain("CodeRabbit changes remain requested on the current PR head; Codex fallback can never clear them.");
    expect(automerge).toContain("src/app/privacy/*|src/app/privacy/**|*/privacy/*");
    expect(automerge).toContain("package-lock.json|pnpm-lock.yaml|yarn.lock|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock");

    expect(agents).toContain("CodeRabbit remains the primary provider for risk-routed final PR review.");
    expect(agents).toContain("Codex may act as an availability fallback only when CI classifies the PR as fallback-eligible medium risk");
    expect(agents).toContain("Codex can never override it");
    expect(agents).toContain("remain CodeRabbit-only under the automated fallback policy");
  });
});
