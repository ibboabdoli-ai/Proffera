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
    expect(router).toContain("proffera-automerge.yml");
    expect(wakeup).not.toContain("issue_comment:");
    expect(wakeup).not.toContain("pull_request_review:");
    expect(automerge).not.toContain("issue_comment:");
    expect(automerge).not.toContain("pull_request_review:");
    expect(handoff).not.toContain("issue_comment:");
    expect(handoff).toContain("comment_id:");
  });

  it("enforces a deterministic two-writable-worker ceiling", () => {
    const helper = source("scripts/supervisor-worker-handoff.mjs");
    expect(helper).toContain("MAX_WRITABLE_WORKERS = 2");
    expect(helper).toContain('"capacity_blocked"');
    expect(helper).toContain("countWritableTaskStates");
    expect(helper).toContain("isTrustedWritableWorkerPr");
  });

  it("keeps autonomous planning behind two kill switches and deterministic admission", () => {
    const planner = source(".github/workflows/supervisor-planner.yml");
    expect(planner).toContain("worker-dispatch-enabled");
    expect(planner).toContain("supervisor-autopilot-enabled");
    expect(planner).toContain("supervisor-worker-handoff.mjs evaluate");
    expect(planner).toContain("supervisor-next-task.json");
    expect(planner).toContain("production_mutation_allowed=false");
    expect(planner).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
  });

  it("batches current-head repair and refuses unbounded repair loops", () => {
    const repair = source(".github/workflows/supervisor-review-repair.yml");
    expect(repair).toContain("sleep 45");
    expect(repair).toContain("consecutive");
    expect(repair).toContain("[review-repair]");
    expect(repair).toContain("validate-changes");
    expect(repair).toContain("git push origin");
    expect(repair).not.toContain("--force");
  });

  it("collapses superseded worker reconciliation runs", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("cancel-in-progress: true");
  });
});
