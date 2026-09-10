import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function workflowSource() {
  return readFileSync(
    resolve(process.cwd(), ".github/workflows/supervisor-worker-handoff.yml"),
    "utf8",
  );
}

describe("Supervisor Worker handoff large-state safety", () => {
  it("filters Supervisor comments to the current task marker before jq argv construction", () => {
    const workflow = workflowSource();
    const marker = 'state_marker="<!-- proffera-worker-task-state:${task_id} -->"';
    const boundedComments =
      'jq -s --arg marker "$state_marker" \'[.[] | select(.user.login == "github-actions[bot]" and ((.body // "") | contains($marker)))]\'';

    expect(workflow.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBe(2);
    expect(workflow.match(new RegExp(boundedComments.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBe(2);

    const preflight = workflow.slice(
      workflow.indexOf("packet=\"$(cat \"$packet_file\")\""),
      workflow.indexOf("  dispatch:"),
    );
    expect(preflight).toContain('--argjson comments "$comments_json"');
    expect(preflight).toContain('--arg marker "$state_marker"');

    const reconcile = workflow.slice(
      workflow.indexOf("Reconcile live state again immediately before publication"),
      workflow.indexOf("Commit bounded Worker result locally"),
    );
    expect(reconcile).toContain('--argjson comments "$comments_json"');
    expect(reconcile).toContain('--arg marker "$state_marker"');
  });
});
