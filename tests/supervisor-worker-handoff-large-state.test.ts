import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function workflowSource() {
  return readFileSync(
    resolve(process.cwd(), ".github/workflows/supervisor-worker-handoff.yml"),
    "utf8",
  );
}

function occurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
}

function workerDispatchAllowed(input: {
  runAttempt: number;
  persistedState: string;
  persistedRunId: string;
  currentRunId: string;
}) {
  return !(
    input.runAttempt > 1 &&
    input.persistedState === "TASK_CREATED" &&
    input.persistedRunId === input.currentRunId
  );
}

describe("Supervisor Worker handoff large-state safety", () => {
  it("filters Supervisor comments to the current task marker before jq argv construction", () => {
    const workflow = workflowSource();
    const marker = 'state_marker="<!-- proffera-worker-task-state:${task_id} -->"';
    const boundedComments =
      'jq -s --arg marker "$state_marker" \'[.[] | select(.user.login == "github-actions[bot]" and ((.body // "") | contains($marker)))]\'';

    expect(occurrences(workflow, marker)).toBe(2);
    expect(occurrences(workflow, boundedComments)).toBe(2);

    const preflight = workflow.slice(
      workflow.indexOf("packet=\"$(cat \"$packet_file\")\""),
      workflow.indexOf("  dispatch:"),
    );
    const preflightFilter = preflight.indexOf('--arg marker "$state_marker"');
    const preflightContext = preflight.indexOf('--argjson comments "$comments_json"');
    expect(preflightFilter).toBeGreaterThanOrEqual(0);
    expect(preflightContext).toBeGreaterThan(preflightFilter);

    const reconcile = workflow.slice(
      workflow.indexOf("Reconcile live state again immediately before publication"),
      workflow.indexOf("Commit bounded Worker result locally"),
    );
    const reconcileFilter = reconcile.indexOf('--arg marker "$state_marker"');
    const reconcileContext = reconcile.indexOf('--argjson comments "$comments_json"');
    expect(reconcileFilter).toBeGreaterThanOrEqual(0);
    expect(reconcileContext).toBeGreaterThan(reconcileFilter);
  });

  it("blocks a second Worker when a rerun retains TASK_CREATED for the same GitHub run", () => {
    expect(
      workerDispatchAllowed({
        runAttempt: 1,
        persistedState: "TASK_CREATED",
        persistedRunId: "12345",
        currentRunId: "12345",
      }),
    ).toBe(true);

    expect(
      workerDispatchAllowed({
        runAttempt: 2,
        persistedState: "TASK_CREATED",
        persistedRunId: "12345",
        currentRunId: "12345",
      }),
    ).toBe(false);

    expect(
      workerDispatchAllowed({
        runAttempt: 2,
        persistedState: "WORKER_BLOCKED",
        persistedRunId: "12345",
        currentRunId: "12345",
      }),
    ).toBe(true);

    const workflow = workflowSource();
    const guardName = "Refuse duplicate Worker dispatch on workflow rerun";
    const workerName = "Run one bounded implementation Worker";
    const guardStart = workflow.indexOf(guardName);
    const workerStart = workflow.indexOf(workerName);
    const guard = workflow.slice(guardStart, workerStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(workerStart).toBeGreaterThan(guardStart);
    expect(guard).toContain("github.run_attempt > 1");
    expect(guard).toContain('state_author" != "github-actions[bot]"');
    expect(guard).toContain("TASK_CREATED");
    expect(guard).toContain("Run ID");
    expect(guard).toContain("WORKER_BLOCKED");
    expect(guard).toContain("exit 1");
    expect(guard).toContain("|| true");
  });
});
