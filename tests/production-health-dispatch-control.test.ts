import {
  chmodSync,
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
    expect(workflow).toContain('[ "$deployed_sha" != "$target_sha" ]');
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
    expect(workflow).toContain('if ! [[ "$merged_sha" =~ ^[0-9a-f]{40}$ ]]');
  });
});
