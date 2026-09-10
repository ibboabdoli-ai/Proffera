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
});
