import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Supervisor control-plane v2", () => {
  it("routes review/comment fan-out through one event router", () => {
    const router = source(".github/workflows/supervisor-event-router.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    const automerge = source(".github/workflows/proffera-automerge.yml");
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");

    expect(router).toContain("issue_comment:");
    expect(router).toContain("pull_request_review:");
    expect(router).toContain("supervisor-worker-handoff.yml");
    expect(router).toContain("proffera-final-gate-wakeup.yml");
    expect(router).toContain('REVIEW_STATE:-}" = "approved"');

    expect(wakeup).not.toContain("issue_comment:");
    expect(wakeup).not.toContain("pull_request_review:");
    expect(automerge).not.toContain("issue_comment:");
    expect(automerge).not.toContain("pull_request_review:");
    expect(handoff).not.toContain("issue_comment:");
    expect(handoff).toContain("comment_id:");
  });

  it("enforces a deterministic two-writable-worker union ceiling", () => {
    const helper = source("scripts/supervisor-worker-handoff.mjs");
    expect(helper).toContain("collectWritableTaskIds");
    expect(helper).toContain("activeWorkerIds");
    expect(helper).toContain("activeWorkerIds.size >= 2");
    expect(helper).toContain('"writable_worker_limit"');
    expect(helper).toContain('if (units >= 2) return ownershipRefusal("capacity_blocked"');
  });

  it("keeps autonomous planning behind two kill switches and internal deterministic admission", () => {
    const planner = source(".github/workflows/supervisor-planner.yml");
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const helper = source("scripts/supervisor-worker-handoff.mjs");

    expect(planner).toContain("worker-dispatch-enabled");
    expect(planner).toContain("supervisor-autopilot-enabled");
    expect(planner).toContain("supervisor-worker-handoff.mjs evaluate");
    expect(planner).toContain("supervisor-next-task.json");
    expect(planner).toContain('cron: "17 * * * *"');
    expect(planner).toContain("planner_packet_b64");
    expect(planner).toContain("supervisor-worker-handoff.yml");
    expect(planner).toContain("active_state_ids");
    expect(planner).toContain("active_pr_ids");
    expect(planner).toContain("sort -u");
    expect(planner).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(planner).not.toContain('POST "repos/${REPOSITORY}/issues/548/comments"');

    expect(handoff).toContain("trusted_internal_dispatch");
    expect(helper).toContain('AUTOPILOT_ENABLE_LABEL = "supervisor-autopilot-enabled"');
    expect(helper).toContain('"autopilot_kill_switch_off"');
    expect(handoff).toContain("validate-state");
    expect(handoff).toContain("Refused read-only: canonical task-state binding is invalid");
    expect(handoff).toContain("Refused read-only: duplicate canonical task-state records exist for $task_id");
  });

  it("qualifies current-head repair before any Codex repair call", () => {
    const repair = source(".github/workflows/supervisor-review-repair.yml");

    expect(repair).toContain("sleep 45");
    expect(repair).toContain("Qualify current-head material findings before model repair");
    expect(repair).toContain("current_inline");
    expect(repair).toContain("blocking_reviews");
    expect(repair).toContain("steps.qualify.outputs.repair == 'yes'");
    expect(repair).toContain("consecutive");
    expect(repair).toContain("[review-repair]");
    expect(repair).toContain("validate-changes");
    expect(repair).not.toContain("--force");
  });

  it("serializes durable lifecycle transitions while cancelling superseded check reconciliation", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");

    expect(sync).toContain("proffera-worker-lifecycle-");
    expect(sync).toContain("proffera-worker-checks-");
    expect(sync).toContain("cancel-in-progress: false");
    expect(sync).toContain("cancel-in-progress: true");
    expect(sync).toContain("task_count");
    expect(sync).toContain('if [ "$task_count" -ne 1 ]');
    expect(sync).toContain("validate-state");
  });
});
