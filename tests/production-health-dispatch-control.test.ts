import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

type FakeHealthMode = "push-success" | "dispatch-success" | "dispatch-failure" | "missing";

function runBaseHealth(mode: FakeHealthMode) {
  const bin = mkdtempSync(resolve(tmpdir(), "proffera-health-dispatch-"));
  const gh = resolve(bin, "gh");

  writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"/contents/.github/workflows/"* ]]; then
  printf '{}\\n'
  exit 0
fi

success='{"workflow_runs":[{"event":"push","status":"completed","conclusion":"success","created_at":"2026-08-24T10:00:00Z"}]}'
dispatch_success='{"workflow_runs":[{"event":"repository_dispatch","status":"completed","conclusion":"success","created_at":"2026-08-24T10:01:00Z"}]}'
dispatch_failure='{"workflow_runs":[{"event":"repository_dispatch","status":"completed","conclusion":"failure","created_at":"2026-08-24T10:01:00Z"}]}'
empty='{"workflow_runs":[]}'

case "${mode}:$args" in
  push-success:*event=push*) printf '%s\\n' "$success" ;;
  push-success:*event=repository_dispatch*) printf '%s\\n' "$empty" ;;
  dispatch-success:*event=push*) printf '%s\\n' "$empty" ;;
  dispatch-success:*event=repository_dispatch*) printf '%s\\n' "$dispatch_success" ;;
  dispatch-failure:*event=push*) printf '%s\\n' "$empty" ;;
  dispatch-failure:*event=repository_dispatch*) printf '%s\\n' "$dispatch_failure" ;;
  missing:*) printf '%s\\n' "$empty" ;;
  *) printf '%s\\n' "$empty" ;;
esac
`);
  chmodSync(gh, 0o755);

  try {
    return spawnSync("bash", [resolve(process.cwd(), "scripts/production-base-health.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        REPOSITORY: "ibboabdoli-ai/Proffera",
        BASE_SHA: "1111111111111111111111111111111111111111",
        HEALTH_WORKFLOW: "production-health.yml",
        BASE_HEALTH_ATTEMPTS: "1",
        BASE_HEALTH_SLEEP_SECONDS: "0",
      },
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

function runAutomergePostMergeFixture(merged: boolean, mergeCommitSha: string) {
  const workflow = source(".github/workflows/proffera-automerge.yml");
  const startMarker = '          merge_output="$(gh pr merge "$pr_number"';
  const start = workflow.indexOf(startMarker);

  if (start < 0) {
    throw new Error("Could not locate the gated automerge post-merge block");
  }

  const postMergeBlock = workflow
    .slice(start)
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");

  const bin = mkdtempSync(resolve(tmpdir(), "proffera-automerge-merge-confirmation-"));
  const gh = resolve(bin, "gh");
  const sleep = resolve(bin, "sleep");
  const summary = resolve(bin, "summary.md");
  const dispatchMarker = resolve(bin, "dispatch-called");
  const apiPayload = JSON.stringify({ merged, merge_commit_sha: mergeCommitSha });

  writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "pr" ] && [ "$2" = "merge" ]; then
  printf 'merge accepted\\n'
  exit 0
fi
if [ "$1" = "api" ] && [[ "$*" == *"/pulls/706"* ]]; then
  printf '%s\\n' '${apiPayload}'
  exit 0
fi
if [ "$1" = "api" ] && [[ "$*" == *"/dispatches"* ]]; then
  : > "$DISPATCH_MARKER"
  exit 0
fi
printf 'unexpected gh invocation: %s\\n' "$*" >&2
exit 2
`);
  writeFileSync(sleep, "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(gh, 0o755);
  chmodSync(sleep, 0o755);
  writeFileSync(summary, "");

  const script = `set -euo pipefail
summary() {
  echo "$1" >> "$GITHUB_STEP_SUMMARY"
}
REPOSITORY="ibboabdoli-ai/Proffera"
pr_number="706"
head_sha="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
${postMergeBlock}`;

  try {
    const result = spawnSync("bash", ["-c", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        GITHUB_STEP_SUMMARY: summary,
        DISPATCH_MARKER: dispatchMarker,
      },
    });

    return {
      result,
      summary: readFileSync(summary, "utf8"),
      dispatched: existsSync(dispatchMarker),
    };
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

describe("Production health dispatch control", () => {
  it("keeps push health and accepts an exact-base repository dispatch result", () => {
    const push = runBaseHealth("push-success");
    const dispatch = runBaseHealth("dispatch-success");

    expect(push.status, push.stderr).toBe(0);
    expect(push.stdout).toContain("event=push");
    expect(dispatch.status, dispatch.stderr).toBe(0);
    expect(dispatch.stdout).toContain("event=repository_dispatch");
    expect(dispatch.stdout).toContain("Production is healthy on exact PR base");
  });

  it("fails closed for a failed or missing exact-base dispatch result", () => {
    const failure = runBaseHealth("dispatch-failure");
    const missing = runBaseHealth("missing");

    expect(failure.status).not.toBe(0);
    expect(failure.stdout).toContain("New work is blocked");
    expect(missing.status).not.toBe(0);
    expect(missing.stdout).toContain("No successful Production health result became available");
  });

  it("binds repository dispatch to the current default-branch SHA and exact deployment", () => {
    const workflow = source(".github/workflows/production-health.yml");

    expect(workflow).toContain("repository_dispatch:");
    expect(workflow).toContain("types: [production-health]");
    expect(workflow).toContain("DISPATCH_SHA: ${{ github.event.client_payload.sha }}");
    expect(workflow).toContain('if [ "$DISPATCH_SHA" != "$DEFAULT_BRANCH_SHA" ]');
    expect(workflow).toContain('require_exact_commit=yes');
    expect(workflow).toContain('[ "$deployed_sha" != "$TARGET_SHA" ]');
    expect(workflow).toContain('max_attempts=24');
  });

  it("emits Production health only after a successful gated merge and uses the merged SHA", () => {
    const workflow = source(".github/workflows/proffera-automerge.yml");
    const mergeIndex = workflow.indexOf('gh pr merge "$pr_number"');
    const resolveIndex = workflow.indexOf(".merge_commit_sha // empty");
    const dispatchIndex = workflow.indexOf('repos/$REPOSITORY/dispatches');

    expect(mergeIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(mergeIndex);
    expect(dispatchIndex).toBeGreaterThan(resolveIndex);
    expect(workflow).toContain('{event_type:"production-health",client_payload:{sha:$sha}}');
    expect(workflow).toContain('if [ "$pr_merged" != "true" ] || ! [[ "$merged_sha" =~ ^[0-9a-f]{40}$ ]]');
    expect(workflow).toContain('.merged');
    expect(workflow).toContain('if [ "$pr_merged" != "true" ]');
  });

  it("does not dispatch or claim merged when GitHub still reports an unmerged temporary SHA", () => {
    const temporarySha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const fixture = runAutomergePostMergeFixture(false, temporarySha);

    expect(fixture.result.status).not.toBe(0);
    expect(fixture.dispatched).toBe(false);
    expect(fixture.summary).not.toContain("Proffera gated automerge: merged");
    expect(fixture.result.stderr).toContain("pull request was not confirmed merged");
  });
});
