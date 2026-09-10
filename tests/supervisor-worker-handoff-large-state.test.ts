import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

function workflowStepScript(name: string) {
  const workflow = workflowSource();
  const stepStart = workflow.indexOf(`      - name: ${name}`);
  expect(stepStart).toBeGreaterThanOrEqual(0);
  const runStart = workflow.indexOf("        run: |\n", stepStart);
  const nextStep = workflow.indexOf("\n      - name:", runStart + 1);
  expect(runStart).toBeGreaterThan(stepStart);
  expect(nextStep).toBeGreaterThan(runStart);

  return workflow
    .slice(runStart + "        run: |\n".length, nextStep)
    .split("\n")
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
}

function taskState(state: "TASK_CREATED" | "WORKER_BLOCKED", runId = "12345") {
  return {
    user: { login: "github-actions[bot]" },
    body: [
      "<!-- proffera-worker-task-state:TASK-1 -->",
      `- State: \`${state}\``,
      `- Run ID: \`${runId}\``,
    ].join("\n"),
  };
}

function dispatchEvidence(
  taskId = "TASK-1",
  runId = "12345",
  author = "github-actions[bot]",
) {
  return {
    user: { login: author },
    body: `<!-- proffera-worker-dispatch-start:${taskId}:${runId} -->`,
  };
}

function runWorkflowStep(
  name: string,
  options: { comments?: unknown[]; state?: unknown; failPost?: boolean } = {},
) {
  const directory = mkdtempSync(resolve(tmpdir(), "proffera-handoff-"));
  const calls = resolve(directory, "calls");
  const commentsFile = resolve(directory, "comments.jsonl");
  const stateFile = resolve(directory, "state.json");
  const gh = resolve(directory, "gh");
  const node = resolve(directory, "node");
  const trustedDirectory = resolve(directory, "proffera-trusted-control");
  const trustedHelper = resolve(
    trustedDirectory,
    "supervisor-worker-handoff.mjs",
  );
  const trustedManifest = resolve(
    trustedDirectory,
    "supervisor-worker-handoff.sha256",
  );

  mkdirSync(trustedDirectory);
  copyFileSync(
    resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs"),
    trustedHelper,
  );
  const helperDigest = createHash("sha256")
    .update(readFileSync(trustedHelper))
    .digest("hex");
  writeFileSync(trustedManifest, `${helperDigest}  ${trustedHelper}\n`);
  writeFileSync(calls, "");
  writeFileSync(
    commentsFile,
    (options.comments ?? []).map((value) => JSON.stringify(value)).join("\n") +
      ((options.comments ?? []).length > 0 ? "\n" : ""),
  );
  writeFileSync(
    stateFile,
    JSON.stringify(options.state ?? taskState("WORKER_BLOCKED")),
  );
  writeFileSync(
    node,
    `#!/bin/bash
if [ "\${!#}" = "state-body" ]; then
  cat >/dev/null
  printf 'blocked state body\\n'
else
  exec "${process.execPath}" "$@"
fi
`,
    { mode: 0o755 },
  );
  writeFileSync(
    gh,
    `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "${calls}"
if [[ "$*" == *"issues/548/comments?per_page=100"* ]]; then
  cat "${commentsFile}"
elif [[ "$*" == *"issues/comments/77"* ]]; then
  cat "${stateFile}"
elif [[ "$*" == *"--method POST"* ]] && [ "${options.failPost ? "yes" : "no"}" = yes ]; then
  exit 1
else
  printf '{}\\n'
fi
`,
    { mode: 0o755 },
  );

  const packetB64 = Buffer.from(
    JSON.stringify({ task_id: "TASK-1" }),
    "utf8",
  ).toString("base64");
  const result = spawnSync("bash", ["-c", workflowStepScript(name)], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      RUNNER_TEMP: directory,
      GH_TOKEN: "test-token",
      REPOSITORY: "ibboabdoli-ai/Proffera",
      PACKET_B64: packetB64,
      STATE_COMMENT_ID: "77",
      RUN_ID: "12345",
      RUN_ATTEMPT: "2",
    },
  });

  return {
    ...result,
    calls: readFileSync(calls, "utf8"),
  };
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

  it("blocks a rerun from the actual guard when trusted dispatch-start evidence exists", () => {
    const result = runWorkflowStep("Refuse duplicate Worker dispatch on workflow rerun", {
      comments: [dispatchEvidence()],
      state: taskState("WORKER_BLOCKED"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("trusted dispatch-start evidence already exists");
    expect(result.calls).toContain("issues/548/comments?per_page=100");
    expect(result.calls).not.toContain("issues/comments/77");
  });

  it("keeps retained TASK_CREATED fail-closed through the actual workflow guard", () => {
    const result = runWorkflowStep("Refuse duplicate Worker dispatch on workflow rerun", {
      comments: [],
      state: taskState("TASK_CREATED"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("retained TASK_CREATED");
    expect(result.calls).toContain("issues/comments/77");
  });

  it("does not block a different task or run on unrelated dispatch evidence", () => {
    const differentRun = runWorkflowStep(
      "Refuse duplicate Worker dispatch on workflow rerun",
      {
        comments: [dispatchEvidence("TASK-1", "99999")],
        state: taskState("WORKER_BLOCKED"),
      },
    );
    const untrustedEvidence = runWorkflowStep(
      "Refuse duplicate Worker dispatch on workflow rerun",
      {
        comments: [dispatchEvidence("TASK-1", "12345", "someone-else")],
        state: taskState("WORKER_BLOCKED"),
      },
    );

    expect(differentRun.status).toBe(0);
    expect(untrustedEvidence.status).toBe(0);
  });

  it("persists dispatch-start evidence fail-closed before Worker execution", () => {
    const success = runWorkflowStep("Persist trusted Worker dispatch-start evidence");
    const failedPost = runWorkflowStep("Persist trusted Worker dispatch-start evidence", {
      failPost: true,
    });

    expect(success.status).toBe(0);
    expect(success.calls).toContain("--method POST");
    expect(success.calls).toContain("issues/548/comments");
    expect(failedPost.status).not.toBe(0);
  });

  it("orders the real rerun guard and dispatch evidence before the Worker action", () => {
    const workflow = workflowSource();
    const guard = workflow.indexOf("Refuse duplicate Worker dispatch on workflow rerun");
    const evidence = workflow.indexOf("Persist trusted Worker dispatch-start evidence");
    const worker = workflow.indexOf("Run one bounded implementation Worker");

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(evidence).toBeGreaterThan(guard);
    expect(worker).toBeGreaterThan(evidence);
    expect(workflow.slice(guard, worker)).toContain("github.run_attempt > 1");
  });
});
