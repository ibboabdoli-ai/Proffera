import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { workflowJobPermissions } from "./github-workflow-yaml";

const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as {
  load: (source: string) => { permissions: unknown; jobs: Record<string, unknown> };
};

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

/** Check actual router permissions, not matching text in comments or commands. */
function expectRouterPermissions(workflow: string) {
  expect(workflowJobPermissions(workflow, "route")).toStrictEqual({
    actions: "write",
    contents: "read",
    "pull-requests": "read",
  });
}

function workflowJob(workflow: string, jobName: string) {
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const jobStart = lines.findIndex((line) => line === `  ${jobName}:`);
  expect(jobStart, `Missing workflow job: ${jobName}`).toBeGreaterThanOrEqual(0);
  const nextJob = lines.findIndex((line, index) =>
    index > jobStart && /^ {2}[A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line),
  );
  return lines.slice(jobStart, nextJob < 0 ? undefined : nextJob).join("\n");
}

function workflowRunStep(workflow: string, stepName: string) {
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const stepIndex = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  const runIndex = lines.findIndex((line, index) => index > stepIndex && line.trim() === "run: |");
  expect(runIndex).toBeGreaterThan(stepIndex);
  const runIndent = lines[runIndex].match(/^\s*/)?.[0].length ?? 0;
  const script: string[] = [];
  for (let index = runIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      script.push("");
      continue;
    }
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= runIndent) break;
    script.push(line.slice(Math.min(line.length, runIndent + 2)));
  }
  return script.join("\n");
}

function runPlannerCapacityStep(
  controlComments: Array<Record<string, unknown>>,
  openPrs: Array<Record<string, unknown>> = [],
) {
  const workflow = source(".github/workflows/supervisor-planner.yml");
  const scriptBody = workflowRunStep(workflow, "Skip model call when writable capacity is already full");
  const dir = mkdtempSync(join(tmpdir(), "proffera-planner-capacity-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "capacity.sh");
  const output = join(dir, "github-output.txt");

  writeFileSync(fakeGh, `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { writeSync } = require("node:fs");
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const jqIndex = args.indexOf("--jq");
const emit = (payload) => {
  const raw = JSON.stringify(payload);
  if (jqIndex < 0) {
    writeSync(1, raw + "\\n");
    process.exit(0);
  }
  const expression = args[jqIndex + 1];
  if (!expression) {
    process.stderr.write("missing --jq expression\\n");
    process.exit(93);
  }
  const result = spawnSync("jq", ["-r", expression], {
    input: raw,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) writeSync(1, result.stdout);
  if (result.stderr) writeSync(2, result.stderr);
  process.exit(result.status ?? 1);
};
if (endpoint.includes("/issues/548/comments?per_page=100")) {
  const comments = JSON.parse(process.env.FAKE_CONTROL_COMMENTS || "[]");
  emit(comments);
}
process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
process.exit(91);
`, { mode: 0o755 });

  writeFileSync(join(dir, "supervisor-context.json"), JSON.stringify({ open_prs: openPrs }));
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
gh() { node "${fakeGh.replaceAll("\\", "/")}" "$@"; }
REPOSITORY=ibboabdoli-ai/Proffera
GITHUB_OUTPUT="\${GITHUB_OUTPUT}"
${scriptBody}
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
      FAKE_CONTROL_COMMENTS: JSON.stringify(controlComments),
      GITHUB_OUTPUT: output,
    },
  });

  let outputs = "";
  try {
    outputs = readFileSync(output, "utf8");
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  return { result, outputs };
}

function runPlannerContextStep(largePrBodySize = 180_000) {
  const workflow = source(".github/workflows/supervisor-planner.yml");
  const scriptBody = workflowRunStep(workflow, "Build live planning context");
  const dir = mkdtempSync(join(tmpdir(), "proffera-planner-context-"));
  const fakeGh = join(dir, "gh");
  const fakeGit = join(dir, "git");
  const script = join(dir, "context.sh");
  const mainSha = "a".repeat(40);
  const prHead = "b".repeat(40);

  writeFileSync(fakeGit, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.join(" ") === "rev-parse HEAD") {
  process.stdout.write(process.env.FAKE_MAIN_SHA + "\\n");
  process.exit(0);
}
process.stderr.write("unexpected git call: " + JSON.stringify(args) + "\\n");
process.exit(92);
`, { mode: 0o755 });

  writeFileSync(fakeGh, `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { writeSync } = require("node:fs");
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const jqIndex = args.indexOf("--jq");
const emit = (payload) => {
  const raw = JSON.stringify(payload);
  if (jqIndex < 0) {
    writeSync(1, raw + "\\n");
    process.exit(0);
  }
  const expression = args[jqIndex + 1];
  if (!expression) {
    process.stderr.write("missing --jq expression\\n");
    process.exit(93);
  }
  const result = spawnSync("jq", ["-r", expression], {
    input: raw,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) writeSync(1, result.stdout);
  if (result.stderr) writeSync(2, result.stderr);
  process.exit(result.status ?? 1);
};
if (endpoint.endsWith("/issues/548")) {
  emit({ body: "planner body" });
}
if (endpoint.includes("/pulls?state=open&base=main&per_page=100")) {
  const body = "y".repeat(Number(process.env.FAKE_LARGE_PR_BODY_SIZE || 0));
  emit([{
    number: 849,
    title: "Large planner fixture",
    draft: false,
    head: {
      ref: "work/proffera-supervisor-auto-fastlane",
      sha: process.env.FAKE_PR_HEAD,
      repo: { full_name: "ibboabdoli-ai/Proffera" }
    },
    base: { ref: "main" },
    user: { login: "ibboabdoli-ai" },
    body
  }]);
}
if (endpoint.includes("/pulls/849/files?per_page=100")) {
  emit([{ filename: "src/large-planner-fixture.ts" }]);
}
process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
process.exit(91);
`, { mode: 0o755 });

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
gh() { node "${fakeGh.replaceAll("\\", "/")}" "$@"; }
git() { node "${fakeGit.replaceAll("\\", "/")}" "$@"; }
base64() {
  if [ "\${1:-}" = "--decode" ]; then
    node -e 'let s=""; process.stdin.setEncoding("utf8"); process.stdin.on("data", c => s += c); process.stdin.on("end", () => process.stdout.write(Buffer.from(s.trim(), "base64")));'
  else
    command base64 "$@"
  fi
}
REPOSITORY=ibboabdoli-ai/Proffera
PLANNER_RUN_ID=9001
PLANNER_WORKFLOW_REF=ibboabdoli-ai/Proffera/.github/workflows/supervisor-planner.yml@refs/heads/main
RUNNER_TEMP="\${RUNNER_TEMP}"
${scriptBody}
`, { mode: 0o755 });

  const result = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
      FAKE_MAIN_SHA: mainSha,
      FAKE_PR_HEAD: prHead,
      FAKE_LARGE_PR_BODY_SIZE: String(largePrBodySize),
      RUNNER_TEMP: dir,
    },
  });

  let context: Record<string, unknown> | null = null;
  try {
    context = JSON.parse(readFileSync(join(dir, "supervisor-context.json"), "utf8"));
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  return { result, context, mainSha, prHead };
}

function runReviewRepairPreflight(options: {
  state?: string;
  baseRef?: string;
  headRepo?: string;
  author?: string;
  body?: string;
  headRef?: string;
} = {}) {
  const workflow = source(".github/workflows/supervisor-review-repair.yml");
  const scriptBody = workflowRunStep(workflow, "Resolve trusted exact-head Phase-1 PR");
  const dir = mkdtempSync(join(tmpdir(), "proffera-review-repair-preflight-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "preflight.sh");
  const output = join(dir, "github-output.txt");
  const head = "a".repeat(40);
  writeFileSync(fakeGh, `#!/usr/bin/env node
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
if (!endpoint.endsWith("/pulls/849")) {
  process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
  process.exit(91);
}
process.stdout.write(JSON.stringify({
  state: process.env.FAKE_STATE || "open",
  base: { ref: process.env.FAKE_BASE_REF || "main" },
  head: {
    sha: process.env.FAKE_HEAD,
    ref: process.env.FAKE_HEAD_REF || "work/proffera-review-repair",
    repo: { full_name: process.env.FAKE_HEAD_REPO || "ibboabdoli-ai/Proffera" }
  },
  user: { login: process.env.FAKE_AUTHOR || "ibboabdoli-ai" },
  body: process.env.FAKE_BODY || "<!-- proffera-worker-task-packet:v1 -->"
}) + "\\n");
`, { mode: 0o755 });
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
REPOSITORY=ibboabdoli-ai/Proffera
PR_NUMBER=849
GITHUB_OUTPUT="\${GITHUB_OUTPUT}"
${scriptBody}
`, { mode: 0o755 });
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_HEAD: head,
      FAKE_STATE: options.state ?? "open",
      FAKE_BASE_REF: options.baseRef ?? "main",
      FAKE_HEAD_REPO: options.headRepo ?? "ibboabdoli-ai/Proffera",
      FAKE_AUTHOR: options.author ?? "ibboabdoli-ai",
      FAKE_BODY: options.body ?? "<!-- proffera-worker-task-packet:v1 -->",
      FAKE_HEAD_REF: options.headRef ?? "work/proffera-review-repair",
      GITHUB_OUTPUT: output,
    },
  });
  let outputs = "";
  try {
    outputs = readFileSync(output, "utf8");
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  return { result, outputs, head };
}

function runReviewRepairEvidenceStep(largeBodySize = 800_000) {
  const workflow = source(".github/workflows/supervisor-review-repair.yml");
  const scriptBody = workflowRunStep(workflow, "Settle complete exact-head review finding burst");
  const dir = mkdtempSync(join(tmpdir(), "proffera-review-repair-evidence-"));
  const fakeGh = join(dir, "gh");
  const script = join(dir, "evidence.sh");
  const head = "c".repeat(40);

  writeFileSync(fakeGh, `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { writeSync } = require("node:fs");
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith("repos/")) || "";
const jqIndex = args.indexOf("--jq");
const body = "x".repeat(Number(process.env.FAKE_LARGE_REVIEW_BODY_SIZE || 0));
let payload;
if (endpoint.endsWith("/pulls/849") && jqIndex >= 0) {
  process.stdout.write(process.env.FAKE_HEAD + "\\n");
  process.exit(0);
}
if (endpoint.includes("/issues/849/comments?per_page=100")) {
  payload = [{ id: 1, user: { login: "coderabbitai[bot]" }, body }];
} else if (endpoint.includes("/pulls/849/reviews?per_page=100")) {
  payload = [{ id: 202, user: { login: "coderabbitai[bot]" }, body, commit_id: process.env.FAKE_HEAD, state: "CHANGES_REQUESTED" }];
} else if (endpoint.includes("/pulls/849/comments?per_page=100")) {
  payload = [{ id: 101, user: { login: "chatgpt-codex-connector[bot]" }, body, original_commit_id: process.env.FAKE_HEAD }];
} else {
  process.stderr.write("unexpected gh call: " + JSON.stringify(args) + "\\n");
  process.exit(91);
}
const raw = JSON.stringify(payload);
if (jqIndex < 0) {
  writeSync(1, raw + "\\n");
  process.exit(0);
}
const expression = args[jqIndex + 1];
const result = spawnSync("jq", ["-c", expression], {
  input: raw,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (result.stdout) writeSync(1, result.stdout);
if (result.stderr) writeSync(2, result.stderr);
process.exit(result.status ?? 1);
`, { mode: 0o755 });

  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
gh() { node "${fakeGh.replaceAll("\\", "/")}" "$@"; }
sleep() { :; }
REPOSITORY=ibboabdoli-ai/Proffera
PR_NUMBER=849
HEAD_SHA=${head}
GITHUB_OUTPUT="\${GITHUB_OUTPUT}"
RUNNER_TEMP="\${RUNNER_TEMP}"
${scriptBody}
`, { mode: 0o755 });

  const output = join(dir, "github-output.txt");
  const result = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH ?? "",
      TMPDIR: dir,
      RUNNER_TEMP: dir.replaceAll("\\", "/"),
      GITHUB_OUTPUT: output.replaceAll("\\", "/"),
      FAKE_HEAD: head,
      FAKE_LARGE_REVIEW_BODY_SIZE: String(largeBodySize),
    },
    maxBuffer: 64 * 1024 * 1024,
  });

  const evidenceDir = join(dir, "proffera-review-repair-evidence");
  let evidence: Record<string, unknown> | null = null;
  let findingIds: string[] | null = null;
  let outputs = "";
  try {
    evidence = JSON.parse(readFileSync(join(evidenceDir, "supervisor-review-evidence.json"), "utf8"));
    findingIds = JSON.parse(readFileSync(join(evidenceDir, "finding_ids.json"), "utf8"));
    outputs = readFileSync(output, "utf8");
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  return { result, evidence, findingIds, outputs, head };
}

function runInvalidCloseReconcileFunction(
  mode:
    | "nonzero"
    | "malformed"
    | "ok"
    | "valid_packet"
    | "safe_refusal"
    | "evidence_unavailable"
    | "evidence_changed"
    | "release_not_converged"
    | "task_evidence_changed"
    | "reservation_mutated"
    | "task_mutated",
  occurrence: 0 | 1 = 0,
) {
  const sync = source(".github/workflows/worker-supervisor-sync.yml").replaceAll("\r\n", "\n");
  const signature = "          reconcile_invalid_closed_pr() {";
  let start = sync.indexOf(signature);
  for (let index = 0; index < occurrence && start >= 0; index += 1) {
    start = sync.indexOf(signature, start + signature.length);
  }
  const endMarker = "\n          }\n\n          if";
  const end = sync.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const functionBody = sync
    .slice(start, end + "\n          }".length)
    .split("\n")
    .map((line) => line.startsWith("          ") ? line.slice(10) : line)
    .join("\n");

  const dir = mkdtempSync(join(tmpdir(), "proffera-invalid-close-"));
  const script = join(dir, "invalid-close.sh");
  writeFileSync(script, `#!/usr/bin/env bash
set -euo pipefail
REPOSITORY=ibboabdoli-ai/Proffera
RUN_ID=9001
mutex=fixture-mutex
helper=ignored
MODE="${mode}"
node() {
  cat >/dev/null
  case "$MODE" in
    nonzero) return 73 ;;
    malformed) printf '%s' 'not-json'; return 0 ;;
    ok) printf '%s' '{"ok":true,"code":"reconciled"}'; return 0 ;;
    valid_packet) printf '%s' '{"ok":false,"code":"valid_task_packet","reason":"fixture"}'; return 0 ;;
    safe_refusal) printf '%s' '{"ok":false,"code":"no_exact_provenance","reason":"fixture"}'; return 0 ;;
    evidence_unavailable|evidence_changed|release_not_converged|task_evidence_changed)
      printf '{"ok":false,"code":"%s","reason":"fixture"}' "$MODE"; return 0 ;;
    reservation_mutated) printf '%s' '{"ok":false,"code":"no_exact_provenance","reason":"fixture","reservation_mutated":true}'; return 0 ;;
    task_mutated) printf '%s' '{"ok":false,"code":"no_exact_provenance","reason":"fixture","task_mutated":true}'; return 0 ;;
  esac
}
${functionBody}
if reconcile_invalid_closed_pr 849 fixture; then
  echo reconciled
else
  echo valid-task-packet
fi
`, { mode: 0o755 });
  const result = spawnSync("bash", [script], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

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
    expect(router).toContain(".github/workflows/proffera-final-gate-wakeup.yml?ref=main");
    expect(router).toContain("source_event source_id source_actor source_evidence_time source_review_commit");
    expect(router).toContain("Final-gate provenance dispatch schema is not deployed on main yet");
    expect(router).not.toContain('--ref "$live_head"');
    expect(router).toContain('REVIEW_STATE:-}" = "approved"');
    const routerHeader = router.slice(0, router.indexOf("jobs:"));
    expect(routerHeader).toContain("permissions: {}");
    expect(routerHeader).not.toContain("actions: write");
    expectRouterPermissions(router);
    expect(routerHeader).toContain("cancel-in-progress: false");
    expect(routerHeader).not.toContain("cancel-in-progress: true");
    expect(routerHeader).toContain("github.event.comment.id");
    expect(routerHeader).toContain("github.event.review.id");
    expect(router).toContain(".original_commit_id == $head");

    expect(wakeup).not.toContain("issue_comment:");
    expect(wakeup).not.toContain("pull_request_review:");
    expect(automerge).not.toContain("issue_comment:");
    expect(automerge).not.toContain("pull_request_review:");
    expect(handoff).not.toContain("issue_comment:");
    expect(handoff).toContain("comment_id:");
  });

  describe("parsed router permission contract", () => {
    const permissionBlock = /^    permissions:\n(?: {6}[^\n]*\n)+/m;
    const routerSource = () => source(".github/workflows/supervisor-event-router.yml").replaceAll("\r\n", "\n");
    const replacePermissions = (replacement: string) => {
      const router = routerSource();
      expect(router.match(new RegExp(permissionBlock.source, "gm"))).toHaveLength(1);
      return router.replace(permissionBlock, replacement);
    };

    it.each(["actions", "contents", "pull-requests"])("rejects %s present only in a comment", (permission) => {
      const router = routerSource();
      const declaration = "      " + permission + ": " + workflowJobPermissions(router, "route")[permission];
      expect(router.split(declaration)).toHaveLength(2);
      const mutated = router.replace(declaration, "      # " + declaration.trim());
      expect(workflowJobPermissions(mutated, "route")).not.toHaveProperty(permission);
      expect(() => expectRouterPermissions(mutated)).toThrow();
    });

    it.each([
      ["actions", "read"],
      ["contents", "write"],
      ["pull-requests", "write"],
    ])("rejects changed %s even when a comment retains its expected value", (permission, value) => {
      const router = routerSource();
      const declaration = "      " + permission + ": " + workflowJobPermissions(router, "route")[permission];
      expect(router.split(declaration)).toHaveLength(2);
      const mutated = router.replace(declaration, "      " + permission + ": " + value + " # " + declaration.trim());
      expect(workflowJobPermissions(mutated, "route")).toHaveProperty(permission, value);
      expect(() => expectRouterPermissions(mutated)).toThrow();
    });

    it.each(["issues: read", '"issues": write', "'issues': none", "issues: null", "statuses: write"])(
      "rejects an additional permission: %s",
      (extraPermission) => {
        const mutated = routerSource().replace("    permissions:\n", "    permissions:\n      " + extraPermission + "\n");
        expect(Object.keys(workflowJobPermissions(mutated, "route"))).toHaveLength(4);
        expect(() => expectRouterPermissions(mutated)).toThrow();
      },
    );

    it.each(["\n", "\r\n"])("accepts equivalent quoted/reordered YAML and flow maps (%j)", (newline) => {
      for (const mapping of [
        "    permissions:\n      'pull-requests': read\n      contents: 'read'\n      \"actions\": write # Still job-local.\n",
        "    permissions: { 'pull-requests': read, contents: read, actions: write }\n",
      ]) {
        expectRouterPermissions(replacePermissions(mapping).replaceAll("\n", newline));
      }
    });

    it("rejects additional issues access in a flow mapping", () => {
      const mutated = replacePermissions("    permissions: { actions: write, contents: read, pull-requests: read, issues: write }\n");
      expect(workflowJobPermissions(mutated, "route")).toHaveProperty("issues", "write");
      expect(() => expectRouterPermissions(mutated)).toThrow();
    });

    it("does not substitute workflow defaults or another job's permissions", () => {
      const inheritedOnly = replacePermissions("").replace(
        "permissions: {}",
        "permissions: { actions: write, contents: read, pull-requests: read }",
      );
      const otherJobOnly = routerSource().replace("  route:\n", "  other:\n")
        + "\n  route:\n    runs-on: ubuntu-latest\n    steps: []\n";
      for (const mutated of [inheritedOnly, otherJobOnly, routerSource().replace("  route:\n", "  other:\n")]) {
        expect(() => workflowJobPermissions(mutated, "route")).toThrow("must define a permissions mapping");
      }
    });

    it.each(["read-all", "write-all", "null", "[]"])("rejects a non-mapping permissions value: %s", (value) => {
      const mutated = replacePermissions("    permissions: " + value + "\n");
      expect(() => workflowJobPermissions(mutated, "route")).toThrow("must define a permissions mapping");
    });

    it("rejects duplicate permission keys instead of accepting the later value", () => {
      const mutated = routerSource().replace("    permissions:\n", "    permissions:\n      contents: write\n");
      expect(() => workflowJobPermissions(mutated, "route")).toThrow(/duplicated mapping key/);
    });
  });

  it("enforces a deterministic two-writable-worker union ceiling", () => {
    const helper = source("scripts/supervisor-worker-handoff.mjs");
    expect(helper).toContain("collectWritableTaskIds");
    expect(helper).toContain("activeWorkerIds");
    expect(helper).toContain("activeWorkerIds.size >= 2");
    expect(helper).toContain('"writable_worker_limit"');
    expect(helper).toContain('if (units >= 2) return ownershipRefusal("capacity_blocked"');
  });

  describe("planner reusable-workflow permission ceiling", () => {
    const plannerSource = () => source(".github/workflows/supervisor-planner.yml");
    const handoffSource = () => source(".github/workflows/supervisor-worker-handoff.yml");
    const readOnlyPermissions = {
      actions: "read",
      contents: "read",
      issues: "read",
      "pull-requests": "read",
    };

    function permissionLevel(value: unknown) {
      switch (value) {
        case undefined:
        case "none": return 0;
        case "read": return 1;
        case "write": return 2;
        default: throw new Error("Unexpected workflow permission level: " + String(value));
      }
    }

    function expectCompatiblePermissions(caller: Record<string, unknown>, callee: string) {
      const required: Record<string, number> = {};
      // Every handoff job declares its own permissions. Include conditional jobs:
      // GitHub validates their ceilings even when their if condition will be false.
      const jobs = Object.keys(parseYaml(callee).jobs);
      expect(jobs.length).toBeGreaterThan(0);
      for (const job of jobs) {
        for (const [permission, level] of Object.entries(workflowJobPermissions(callee, job))) {
          required[permission] = Math.max(required[permission] ?? 0, permissionLevel(level));
        }
      }
      for (const [permission, level] of Object.entries(required)) {
        expect(permissionLevel(caller[permission]), "Insufficient reusable caller permission: " + permission)
          .toBeGreaterThanOrEqual(level);
      }
    }

    it("satisfies the maximum permissions requested by every reusable handoff job", () => {
      expectCompatiblePermissions(workflowJobPermissions(plannerSource(), "dispatch"), handoffSource());
    });

    it("rejects the historical pull-requests read ceiling", () => {
      const insufficient = {
        ...workflowJobPermissions(plannerSource(), "dispatch"),
        "pull-requests": "read",
      };
      expect(() => expectCompatiblePermissions(insufficient, handoffSource()))
        .toThrow("Insufficient reusable caller permission: pull-requests");
    });

    it("confines the permission increase to the caller and preserves workflow defaults", () => {
      const planner = plannerSource();
      expect(workflowJobPermissions(planner, "plan")).toStrictEqual(readOnlyPermissions);
      expect(parseYaml(planner).permissions).toStrictEqual(readOnlyPermissions);
      expect(parseYaml(handoffSource()).permissions).toStrictEqual({});
      expect(workflowJobPermissions(planner, "dispatch")).toStrictEqual({
        ...readOnlyPermissions,
        issues: "write",
        "pull-requests": "write",
      });
    });
  });

  it("keeps autonomous planning behind two kill switches and internal deterministic admission", () => {
    const planner = source(".github/workflows/supervisor-planner.yml");
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const helper = source("scripts/supervisor-worker-handoff.mjs");

    expect(planner).toContain("worker-dispatch-enabled");
    expect(planner).toContain("supervisor-autopilot-enabled");
    expect(planner).toContain("Snapshot trusted admission helper");
    expect(planner).toContain('trusted_helper="$RUNNER_TEMP/trusted-supervisor-worker-handoff.mjs"');
    expect(planner).not.toContain("trusted-ci-scope-plan.mjs");
    expect(planner).not.toContain("scripts/ci-scope-plan.mjs");
    expect(planner).toContain('node "$trusted_helper" parse');
    expect(planner).toContain('node "$trusted_helper" evaluate');
    expect(planner).not.toContain("node scripts/supervisor-worker-handoff.mjs parse");
    expect(planner).not.toContain("node scripts/supervisor-worker-handoff.mjs evaluate");
    expect(planner).toContain("supervisor-next-task.json");
    expect(planner).toContain('cron: "17 * * * *"');
    expect(planner).toContain("planner_packet_b64");
    expect(planner).toContain("planner_packet_sha256");
    expect(planner).toContain("planner_run_id");
    expect(planner).toContain("planner_head_sha");
    expect(planner).toContain("planner_packet_sha256");
    expect(planner).toContain("planner_workflow_ref");
    expect(planner).toContain("uses: ./.github/workflows/supervisor-worker-handoff.yml");
    expect(planner).not.toContain("gh workflow run supervisor-worker-handoff.yml");
    expect(planner).toContain("active_reservation_ids");
    expect(planner).toContain("active_pr_ids");
    expect(planner).toContain("sort -u");
    const plannerPlanStart = planner.indexOf("  plan:");
    const plannerDispatchBoundary = planner.indexOf("  dispatch:", plannerPlanStart);
    const plannerPlanJob = planner.slice(plannerPlanStart, plannerDispatchBoundary);
    expect(plannerPlanJob).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    const plannerDispatchSecrets = planner.slice(plannerDispatchBoundary);
    expect(plannerDispatchSecrets).toContain("issues: write");
    expect(plannerDispatchSecrets).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(plannerDispatchSecrets).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN: ${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}");
    expect(planner).not.toContain('POST "repos/${REPOSITORY}/issues/548/comments"');
    const plannerValidationStart = planner.indexOf("Validate planner output against live state");
    const plannerDispatchStart = planner.indexOf("\n  dispatch:", plannerValidationStart);
    const plannerValidation = planner.slice(plannerValidationStart, plannerDispatchStart);
    expect(plannerValidation).toContain("PLANNER_RUN_ID: ${{ github.run_id }}");
    expect(plannerValidation).toContain("PLANNER_WORKFLOW_REF: ${{ github.workflow_ref }}");
    expect(planner).toContain("risk_class 1..2 only");
    expect(plannerValidation).toContain("autonomous dispatch is limited to risk_class 1 or 2");
    expect(plannerValidation).toContain('node "$trusted_helper" planner-scope-authorize');
    expect(plannerValidation).not.toContain(".fullCiStillRequired");
    expect(plannerValidation).not.toContain("ci-scope-plan.mjs");
    expect(plannerValidation).toContain("Planner scope authorization failed closed");
    expect(helper).toContain('"planner_risk_class_requires_human"');
    expect(helper).toContain('"planner_scope_requires_human"');
    expect(helper).toContain("PLANNER_HUMAN_AUTH_OWNERSHIP");
    expect(helper).toContain("evaluatePlannerScopeAuthorization");

    const workflowCallStart = handoff.indexOf("  workflow_call:");
    const manualDispatchStart = handoff.indexOf("  workflow_dispatch:");
    const pullRequestTargetStart = handoff.indexOf("  pull_request_target:");
    expect(workflowCallStart).toBeGreaterThanOrEqual(0);
    expect(manualDispatchStart).toBeGreaterThan(workflowCallStart);
    expect(pullRequestTargetStart).toBeGreaterThan(manualDispatchStart);
    const workflowCall = handoff.slice(workflowCallStart, manualDispatchStart);
    const manualDispatch = handoff.slice(manualDispatchStart, pullRequestTargetStart);
    expect(workflowCall).toContain("planner_packet_b64:");
    expect(workflowCall).toContain("planner_packet_sha256:");
    expect(workflowCall).toContain("planner_run_id:");
    expect(workflowCall).toContain("planner_head_sha:");
    expect(workflowCall).toContain("planner_workflow_ref:");
    expect(manualDispatch).not.toContain("planner_packet_b64:");
    expect(handoff).toContain("trusted_internal_dispatch");
    expect(handoff).toContain("internal_provenance_verified");
    expect(handoff).toContain("packet_digest_verified");
    expect(handoff).toContain("planner_head_sha");
    expect(handoff).toContain("planner_packet_sha256");
    expect(handoff).toContain('actions/runs/${PLANNER_RUN_ID}');
    expect(handoff).toContain('.github/workflows/supervisor-planner.yml');
    expect(helper).toContain("internal_provenance_verified === true");
    expect(helper).toContain("packet_digest_verified === true");
    expect(helper).toContain("planner_head_mismatch");
    expect(helper).toContain("planner_packet_digest_mismatch");
    expect(helper).toContain('AUTOPILOT_ENABLE_LABEL = "supervisor-autopilot-enabled"');
    expect(helper).toContain('"autopilot_kill_switch_off"');
    expect(handoff).toContain("validate-state");
    expect(handoff).toContain("canonical task-state record is malformed or ambiguous");
    expect(handoff).toContain("Refused read-only: duplicate canonical task-state records exist for $task_id");
    expect((handoff.match(/--arg planner_packet_sha256/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(handoff).toContain("planner_evidence");
    expect(helper).toContain("planner_packet_evidence");
    expect(helper).toContain("plannerPacketFromReservationEvidence");
    const preflightStart = handoff.indexOf("  preflight:");
    const handoffDispatchStart = handoff.indexOf("  dispatch:", preflightStart);
    const preflight = handoff.slice(preflightStart, handoffDispatchStart);
    expect(preflight).toContain("proffera-supervisor-worker-admission-${{ inputs.comment_id || inputs.planner_run_id || github.run_id }}");
    expect(preflight).toContain("cancel-in-progress: false");
    expect(preflight).toContain("Atomically reserve writable Worker slot");
    expect(preflight).toContain("Persist trusted Worker dispatch-start evidence");
    expect(preflight).toContain("issues: write");
    expect(preflight).not.toContain("needs.preflight.outputs.");
    expect(preflight).toContain("steps.evaluate.outputs.state_comment_id");

    const plannerHeader = planner.slice(0, planner.indexOf("jobs:"));
    expect(plannerHeader).not.toContain("concurrency:");
    expect(plannerHeader).toContain("issues: read");
    expect(plannerHeader).not.toContain("issues: write");
    const plannerJob = planner.slice(planner.indexOf("  plan:"), planner.indexOf("  dispatch:"));
    expect(plannerJob).toContain("group: proffera-supervisor-planner-plan");
    expect(plannerJob).toContain("cancel-in-progress: true");
    expect(plannerJob).toContain("issues: read");
    expect(plannerJob).not.toContain("issues: write");
    expect(planner).toContain('--rawfile issue_body "$issue_body_file"');
    expect(planner).toContain('--slurpfile open_prs "$open_prs_file"');
    expect(planner).toContain("open_prs:$open_prs[0]");
    expect(planner).toContain('--slurpfile comments "$state_comments_file"');
    expect(planner).toContain('--slurpfile open_prs "$admission_open_prs_file"');
    expect(planner).toContain("comments:$comments[0],open_prs:$open_prs[0]");
    expect(planner).not.toContain('--argjson comments "$state_comments"');
    expect(planner).not.toContain('--argjson open_prs "$enriched"');
    expect(planner).not.toContain('--argjson pr "$pr"');
    expect(planner).not.toContain('--argjson item "$item"');
    expect(planner).toContain('--slurpfile pr "$pr_file"');
    expect(planner).toContain('--slurpfile files "$files_file"');
    expect(planner).toContain('--slurpfile item "$item_file"');
    const contextStart = planner.indexOf("Build live planning context");
    const snapshotStart = planner.indexOf("Snapshot trusted admission helper", contextStart);
    const cheapStart = planner.indexOf("Skip model call when writable capacity is already full", snapshotStart);
    const modelStart = planner.indexOf("Ask Codex for exactly one next bounded task", cheapStart);
    expect(contextStart).toBeGreaterThanOrEqual(0);
    expect(snapshotStart).toBeGreaterThan(contextStart);
    expect(snapshotStart).toBeLessThan(modelStart);
    const trustedSnapshot = planner.slice(snapshotStart, cheapStart);
    expect(trustedSnapshot).toContain('cp scripts/supervisor-worker-handoff.mjs "$trusted_helper"');
    expect(trustedSnapshot).not.toContain("ci-scope-plan.mjs");
    expect(trustedSnapshot).toContain('chmod 0444 "$trusted_helper"');
    const cheapCapacity = planner.slice(cheapStart, modelStart);
    expect(cheapCapacity).toContain("active_reservation_ids");
    expect(cheapCapacity).toContain("lease_expires_at");
    expect(cheapCapacity).toContain("recovery.expires_at");
    expect(cheapCapacity).toContain('split("\\n")');
    expect(cheapCapacity).not.toContain('Reservation payload:[[:space:]]*`(?<payload>[A-Za-z0-9+/]+={0,2})`[[:space:]]*$"; "m"');
    expect(cheapCapacity).toContain("fromdateiso8601");
    expect(cheapCapacity).toContain('sub("\\\\.[0-9]+Z$"; "Z")');
    expect(cheapCapacity).toContain("reconcile-unbound-tasks sweep");
    expect(cheapCapacity).not.toContain("active_state_ids");
    expect(cheapCapacity).not.toContain('"TASK_CREATED"');
    const plannerDispatchJob = planner.slice(planner.indexOf("  dispatch:"));
    expect(plannerDispatchJob).toContain("issues: write");
    expect(handoff).not.toContain("needs.dispatch.outputs.reservation_comment_id");
    expect(handoff).toContain("if: failure() && needs.preflight.outputs.reservation_comment_id != \'\'");
  });

  it("executes the real planner capacity step and excludes a multiline RELEASED reservation", () => {
    const releasedPayload = Buffer.from(JSON.stringify({
      task_id: "TASK-RELEASED",
      state: "RELEASED",
    }), "utf8").toString("base64");
    const activePayload = Buffer.from(JSON.stringify({
      task_id: "TASK-ACTIVE",
      state: "RESERVED",
      lease_expires_at: "2099-09-20T22:00:00.000Z",
    }), "utf8").toString("base64");

    const result = runPlannerCapacityStep([
      {
        user: { login: "github-actions[bot]" },
        body: [
          "<!-- proffera-worker-slot-reservation:TASK-RELEASED -->",
          "### Worker slot reservation: TASK-RELEASED",
          "- State: `RELEASED`",
          `- Reservation payload: \`${releasedPayload}\``,
        ].join("\n"),
      },
      {
        user: { login: "github-actions[bot]" },
        body: [
          "<!-- proffera-worker-slot-reservation:TASK-ACTIVE -->",
          "### Worker slot reservation: TASK-ACTIVE",
          "- State: `RESERVED`",
          `- Reservation payload: \`${activePayload}\``,
        ].join("\n"),
      },
    ]);

    expect(result.result.status, `${result.result.stderr}\n${String(result.result.error ?? "")}`).toBe(0);
    expect(result.outputs).toContain("proceed=yes");
    expect(result.outputs).not.toContain("proceed=no");
  });

  it("enforces real planner capacity across reservations and multiline trusted PRs", () => {
    const reservation = (taskId: string) => {
      const payload = Buffer.from(JSON.stringify({
        task_id: taskId,
        state: "RESERVED",
        lease_expires_at: "2099-09-20T22:00:00.000Z",
      }), "utf8").toString("base64");

      return {
        user: { login: "github-actions[bot]" },
        body: [
          `<!-- proffera-worker-slot-reservation:${taskId} -->`,
          `### Worker slot reservation: ${taskId}`,
          "- State: `RESERVED`",
          `- Reservation payload: \`${payload}\``,
        ].join("\n"),
      };
    };

    const result = runPlannerCapacityStep([
      reservation("TASK-ACTIVE-1"),
      reservation("TASK-ACTIVE-2"),
    ]);

    expect(result.result.status, `${result.result.stderr}\n${String(result.result.error ?? "")}`).toBe(0);
    expect(result.outputs).toContain("proceed=no");
    expect(result.outputs).not.toContain("proceed=yes");

    const trustedPr = (taskId: string) => ({
      head_repo: "ibboabdoli-ai/Proffera",
      author: "ibboabdoli-ai",
      head_ref: "work/proffera-" + taskId.toLowerCase(),
      body: ["Summary", "<!-- proffera-worker-task-packet:v1 -->", "Task ID: " + taskId, "More"].join("\n"),
    });
    const twoPrs = runPlannerCapacityStep([], [trustedPr("TASK-PR-1"), trustedPr("TASK-PR-2")]);
    expect(twoPrs.result.status, twoPrs.result.stderr).toBe(0);
    expect(twoPrs.outputs).toContain("proceed=no");
    expect(twoPrs.outputs).not.toContain("proceed=yes");

    const deduplicated = runPlannerCapacityStep([reservation("TASK-PR-1")], [trustedPr("TASK-PR-1")]);
    expect(deduplicated.result.status, deduplicated.result.stderr).toBe(0);
    expect(deduplicated.outputs).toContain("proceed=yes");
    expect(deduplicated.outputs).not.toContain("proceed=no");
  });

  it("executes the real planner context step with a large PR object without argv-size failure", () => {
    const result = runPlannerContextStep();
    expect(result.result.status, `${result.result.stderr}\n${String(result.result.error ?? "")}`).toBe(0);
    expect(result.context).not.toBeNull();

    const context = result.context as {
      main_sha: string;
      supervisor_plan: string;
      open_prs: Array<{ number: number; body: string; files: string[] }>;
    };
    expect(context.main_sha).toBe(result.mainSha);
    expect(context.supervisor_plan).toBe("planner body");
    expect(context.open_prs).toHaveLength(1);
    expect(context.open_prs[0].number).toBe(849);
    expect(context.open_prs[0].body).toHaveLength(180_000);
    expect(context.open_prs[0].files).toEqual(["src/large-planner-fixture.ts"]);
  });

  it("recovers a preflight reservation even when trusted publication setup never materializes its helper", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const cleanupStart = handoff.indexOf("  cleanup:");
    expect(cleanupStart).toBeGreaterThan(0);
    const cleanup = handoff.slice(cleanupStart);
    expect(cleanup).toContain("needs: [preflight, dispatch, publish]");
    expect(cleanup).toContain("needs.preflight.outputs.reservation_comment_id != ''");
    expect(cleanup).toContain("needs.publish.result != 'success'");
    expect(cleanup).toContain("Materialize exact baseline cleanup helper independently");
    expect(cleanup).toContain('contents/scripts/supervisor-worker-handoff.mjs?ref=${BASE_SHA}');
    expect(cleanup).toContain("git hash-object");
    expect(cleanup).toContain("released-reservation-retry-body");
    expect(cleanup).toContain("reservation-mutex-acquire");
    expect(cleanup).not.toContain("$RUNNER_TEMP/proffera-trusted-publish/supervisor-worker-handoff.mjs");
  });

  it("isolates Worker candidate execution from trusted publication", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const dispatchStart = handoff.indexOf("  dispatch:");
    const publishStart = handoff.indexOf("  publish:");
    const builder = handoff.slice(dispatchStart, publishStart);
    const publish = handoff.slice(publishStart);
    expect(builder).toContain("Capture untrusted Worker candidate patch");
    expect(builder).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(builder).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(builder).toContain("issues: read");
    expect(builder).not.toContain("issues: write");
    expect(builder).not.toContain("reservation-mutex-acquire");
    expect(builder).not.toContain("gh api --method PATCH");
    expect(builder).not.toContain("gh api --method POST");
    expect(publish).toContain("Materialize trusted publication helper in isolated job");
    expect(publish).toContain("actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0");
    expect(publish).toContain("validate-changes");
    expect(publish).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(publish).not.toContain("npm test");
    expect(publish.indexOf("validate-changes")).toBeLessThan(publish.indexOf("PROFFERA_AUTOFIX_PUSH_TOKEN"));
  });
  it("isolates Review Repair admission, model execution, validation, publication, and durable accounting", () => {
    const repair = source(".github/workflows/supervisor-review-repair.yml");

    expect(repair).toContain("group: proffera-final-gate-memory-${{ inputs.pr_number }}");
    expect(repair).toContain("cancel-in-progress: false");
    expect(repair).toContain("Settle complete exact-head review finding burst");
    expect(repair).toContain("for attempt in $(seq 1 8)");
    expect(repair).toContain("finding_ids.json");
    expect(repair).toContain('"review:" + (.id | tostring)');
    expect(repair).toContain('"inline:" + (.id | tostring)');
    expect(repair).not.toContain("sleep 45");
    expect(repair).not.toContain("[-40:]");
    expect(repair).not.toContain("[-80:]");
    expect(repair).not.toContain("consecutive");
    expect(repair).not.toContain('commits?per_page=100&page=${page}');
    expect(repair).toContain("supervisor-review-repair-strategy-memory.mjs admit");
    expect(source("scripts/supervisor-review-repair-strategy-memory.mjs"))
      .toContain("proffera-review-repair-start:v1");
    expect(repair).toContain("Record durable Review Repair attempt outcome");
    expect(repair).toContain("prepare-outcome");
    expect(repair).toContain("Revalidate settled current-head finding burst before publication");

    const admitStart = repair.indexOf("  admit:");
    const repairStart = repair.indexOf("  repair:");
    const validateStart = repair.indexOf("  validate:");
    const publishStart = repair.indexOf("  publish:");
    const recordStart = repair.indexOf("  record:");
    expect(admitStart).toBeGreaterThan(0);
    expect(repairStart).toBeGreaterThan(admitStart);
    expect(validateStart).toBeGreaterThan(repairStart);
    expect(publishStart).toBeGreaterThan(validateStart);
    expect(recordStart).toBeGreaterThan(publishStart);

    const admitJob = repair.slice(admitStart, repairStart);
    const untrustedRepairJob = repair.slice(repairStart, validateStart);
    const validationJob = repair.slice(validateStart, publishStart);
    const trustedPublishJob = repair.slice(publishStart, recordStart);
    const recordJob = repair.slice(recordStart);

    expect(admitJob).toContain("issues: write");
    expect(admitJob).not.toContain("codex-action@");
    expect(admitJob).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");

    expect(untrustedRepairJob).toContain("Run one batched exact-head repair");
    expect(untrustedRepairJob).toContain("codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e");
    expect(untrustedRepairJob).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(untrustedRepairJob).not.toContain("issues: write");
    expect(untrustedRepairJob).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(untrustedRepairJob).not.toContain("validate-changes");
    expect(untrustedRepairJob).not.toContain("npm ci");
    expect(untrustedRepairJob).not.toContain("npm test");
    expect(untrustedRepairJob).not.toContain("npm run ");

    expect(validationJob).not.toContain("secrets.");
    expect(validationJob).not.toContain("codex-action@");
    expect(validationJob).toContain("persist-credentials: false");
    expect(validationJob).toContain("npm ci --no-audit --no-fund");
    for (const command of ["npm run lint", "npm run typecheck", "npm test", "npm run build"]) {
      expect(validationJob).toContain(command);
      expect(trustedPublishJob).not.toContain(command);
    }
    const integrityStepIndex = validationJob.indexOf("Verify candidate artifact integrity");
    const applyStepIndex = validationJob.indexOf("Apply candidate patch");
    const installStepIndex = validationJob.indexOf("Install repository dependencies");
    expect(integrityStepIndex).toBeGreaterThanOrEqual(0);
    expect(applyStepIndex).toBeGreaterThanOrEqual(0);
    expect(installStepIndex).toBeGreaterThanOrEqual(0);
    expect(integrityStepIndex).toBeLessThan(applyStepIndex);
    expect(applyStepIndex).toBeLessThan(installStepIndex);
    expect(validationJob).toContain("Confirm validated tree matches uploaded candidate");

    expect(trustedPublishJob).toContain("needs: [repair, validate]");
    expect(trustedPublishJob).toContain("needs.validate.result == 'success'");
    expect(repair).toContain("patch_sha256: ${{ steps.diff.outputs.patch_sha256 }}");
    expect(trustedPublishJob).toContain("EXPECTED_PATCH_SHA256: ${{ needs.repair.outputs.patch_sha256 }}");
    expect(trustedPublishJob).toContain('[[ "$EXPECTED_PATCH_SHA256" =~ ^[0-9a-f]{64}$ ]]');
    expect(trustedPublishJob).toContain('sha256sum "$artifact_dir/repair.patch"');
    expect(trustedPublishJob).toContain('test "$downloaded_patch_sha256" = "$EXPECTED_PATCH_SHA256"');
    expect(trustedPublishJob).toContain("Materialize trusted repair helper in isolated publish job");
    expect(trustedPublishJob).toContain("EXPECTED_FINDING_SET_SHA256");
    expect(trustedPublishJob).toContain("Current-head review finding burst changed after model execution");
    expect(trustedPublishJob).toContain("validate-changes");
    expect(trustedPublishJob).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(trustedPublishJob.indexOf("Revalidate settled current-head finding burst before publication"))
      .toBeLessThan(trustedPublishJob.indexOf("PROFFERA_AUTOFIX_PUSH_TOKEN"));

    expect(recordJob).toContain("if: always() && needs.admit.outputs.attempt_started == 'yes'");
    expect(recordJob).toContain("issues: write");
    expect(recordJob).not.toContain("codex-action@");
    expect(recordJob).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(recordJob).toContain("REVIEW_REPAIR_OUTCOME");
    expect(recordJob).toContain("prepare-outcome");
    expect(repair).not.toContain("--force");
  });


  it("rejects altered repair artifacts before execution in validation and publication", () => {
    const workflow = source(".github/workflows/supervisor-review-repair.yml");
    for (const jobName of ["validate", "publish"]) {
      const job = workflowJob(workflow, jobName);
      const script = workflowRunStep(job, "Verify candidate artifact integrity");
      for (const mode of ["valid", "tampered", "malformed-hash", "missing-sidecar"]) {
        const dir = mkdtempSync(join(tmpdir(), "proffera-repair-integrity-"));
        try {
          const artifact = join(dir, "proffera-review-repair-candidate");
          mkdirSync(artifact);
          const original = "exact candidate bytes\n";
          const bytes = mode === "tampered" ? "different candidate bytes\n" : original;
          const digest = (value: string) => createHash("sha256").update(value).digest("hex");
          writeFileSync(join(artifact, "repair.patch"), bytes);
          if (mode !== "missing-sidecar") {
            writeFileSync(join(artifact, "repair.patch.sha256"), digest(bytes) + "  repair.patch\n");
          }
          const result = spawnSync("bash", ["-c", script], {
            encoding: "utf8",
            env: { ...process.env, RUNNER_TEMP: dir.replaceAll("\\", "/"), EXPECTED_PATCH_SHA256: mode === "malformed-hash" ? "bad" : digest(original) },
          });
          expect(result.error).toBeUndefined();
          if (mode === "valid") expect(result.status, result.stderr).toBe(0);
          else expect(result.status, jobName + ":" + mode).not.toBe(0);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    }
  }, 20000);

  it.each(["\n", "\r\n"])("does not borrow a missing validation integrity step from publication (%j)", (newline) => {
    const workflow = source(".github/workflows/supervisor-review-repair.yml").replaceAll("\r\n", "\n");
    const validationJob = workflowJob(workflow, "validate");
    const stepName = "Verify candidate artifact integrity";
    expect(validationJob).toContain(stepName);
    const missingIntegrity = validationJob.replace(
      /      - name: Verify candidate artifact integrity\n[\s\S]*?(?=      - name: )/u,
      "",
    );
    expect(missingIntegrity).not.toContain(stepName);
    const mutated = workflow.replace(validationJob, missingIntegrity).replaceAll("\n", newline);
    expect(() => workflowRunStep(workflowJob(mutated, "validate"), stepName)).toThrow();
    expect(workflowRunStep(workflowJob(mutated, "publish"), stepName)).toContain("downloaded_patch_sha256");
  });

  it("rejects a missing workflow job before extracting its integrity step", () => {
    const workflow = source(".github/workflows/supervisor-review-repair.yml");
    expect(() => workflowJob(workflow, "missing-job")).toThrow();
  });

  it("settles complete large review evidence through files and canonical finding IDs", () => {
    const result = runReviewRepairEvidenceStep();
    expect(result.result.status, `${result.result.stderr}\n${String(result.result.error ?? "")}`).toBe(0);
    expect(result.evidence).not.toBeNull();
    const evidence = result.evidence as {
      head_sha: string;
      issue_comments: Array<{ body: string }>;
      reviews: Array<{ body: string; state: string }>;
      inline_comments: Array<{ body: string }>;
    };
    expect(evidence.head_sha).toBe(result.head);
    expect(evidence.issue_comments).toHaveLength(1);
    expect(evidence.reviews).toHaveLength(1);
    expect(evidence.inline_comments).toHaveLength(1);
    expect(evidence.issue_comments[0].body).toHaveLength(800_000);
    expect(evidence.reviews[0].state).toBe("CHANGES_REQUESTED");
    expect(result.findingIds).toEqual(["inline:101", "review:202"]);
    expect(result.outputs).toContain("finding_count=2");
    expect(result.result.stdout).toContain("Settled exact-head review burst: 2 material finding IDs.");
  }, 20000);

  it("keeps preflight on live PR provenance and removes commit-based attempt budgeting", () => {
    const valid = runReviewRepairPreflight();
    expect(valid.result.status, valid.result.stderr).toBe(0);
    expect(valid.outputs).toContain("head_sha=" + valid.head);
    expect(valid.outputs).toContain("head_ref=work/proffera-review-repair");

    for (const invalid of [
      runReviewRepairPreflight({state: "closed"}),
      runReviewRepairPreflight({baseRef: "release"}),
      runReviewRepairPreflight({headRepo: "other/repo"}),
      runReviewRepairPreflight({author: "other-owner"}),
      runReviewRepairPreflight({body: "no trusted task packet"}),
      runReviewRepairPreflight({headRef: "feature/not-worker"}),
    ]) {
      expect(invalid.result.status).not.toBe(0);
    }

    const workflow = source(".github/workflows/supervisor-review-repair.yml");
    const preflight = workflowRunStep(workflow, "Resolve trusted exact-head Phase-1 PR");
    expect(preflight).not.toContain("[review-repair]");
    expect(preflight).not.toContain("/commits?per_page=");
    expect(preflight).not.toContain("consecutive");
    expect(source("scripts/supervisor-review-repair-strategy-memory.mjs"))
      .toContain("MAX_AUTOMATIC_REVIEW_REPAIR_ATTEMPTS = 2");
  }, 20000);

  it("trusted review-repair validation rejects checkout-helper tampering and out-of-scope writes", () => {
    const trustedSource = resolve(root, "scripts/supervisor-worker-handoff.mjs");
    const dir = mkdtempSync(join(tmpdir(), "proffera-review-repair-trust-"));
    const trusted = join(dir, "trusted-helper.mjs");
    copyFileSync(trustedSource, trusted);

    const packet = {
      task_id: "SUP-REPAIR-1",
      supervisor_issue: 548,
      repository: "ibboabdoli-ai/Proffera",
      task_title: "Repair trust fixture",
      task_goal: "Keep repair changes inside the declared scope.",
      graph_path: "repair/trust",
      base_sha: "a".repeat(40),
      branch: "work/proffera-repair-trust",
      allowed_paths: ["src/allowed/"],
      forbidden_paths: ["src/blocked/"],
      required_checks: ["validate","codeql","targeted-ci-shadow","production-base-health","ai-review","final-gate"],
      risk_class: 2,
      production_mutation_allowed: false,
      merge_allowed: false,
      auto_merge_allowed: false,
    };
    const input = JSON.stringify({ packet, changed_files: ["src/outside.ts"] });
    const repair = source(".github/workflows/supervisor-review-repair.yml");
    const publishStart = repair.indexOf("  publish:");
    expect(publishStart).toBeGreaterThan(0);
    const trustedPublishJob = repair.slice(publishStart);
    const materializeStart = trustedPublishJob.indexOf("Materialize trusted repair helper in isolated publish job");
    const validateStart = trustedPublishJob.indexOf("Validate bounded repair with isolated exact-main helper");
    expect(materializeStart).toBeGreaterThanOrEqual(0);
    expect(validateStart).toBeGreaterThan(materializeStart);
    const materializeStep = trustedPublishJob.slice(materializeStart, validateStart);
    expect(materializeStep).toContain("set -euo pipefail");
    expect(materializeStep).toContain('test "$(git hash-object "$trusted_helper")" = "$expected_blob_sha"');

    const verified = spawnSync(process.execPath, [trusted, "validate-changes"], { input, encoding: "utf8" });
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ ok: false, code: "out_of_scope_change" });
  });

  it("fails closed in both invalid-close reconciliation copies and preserves valid-packet fallthrough", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect((sync.match(/reconcile_invalid_closed_pr\(\) \{/g) ?? []).length).toBe(2);
    expect((sync.match(/invalid-close-reconcile\)"/g) ?? []).length).toBe(2);
    expect((sync.match(/\|\| helper_status=\$\?/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sync.match(/jq -e 'type == "object"'/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sync.match(/refusing to report convergence/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const retryableModes = [
      "evidence_unavailable",
      "evidence_changed",
      "release_not_converged",
      "task_evidence_changed",
      "reservation_mutated",
      "task_mutated",
    ] as const;

    for (const occurrence of [0, 1] as const) {
      const nonzero = runInvalidCloseReconcileFunction("nonzero", occurrence);
      expect(nonzero.status).toBe(1);
      expect(nonzero.stderr).toContain("invalid-close-reconcile failed or returned invalid JSON");

      const malformed = runInvalidCloseReconcileFunction("malformed", occurrence);
      expect(malformed.status).toBe(1);
      expect(malformed.stderr).toContain("invalid-close-reconcile failed or returned invalid JSON");

      const ok = runInvalidCloseReconcileFunction("ok", occurrence);
      expect(ok.status, ok.stderr).toBe(0);
      expect(ok.stdout).toContain("reconciled");

      const validPacket = runInvalidCloseReconcileFunction("valid_packet", occurrence);
      expect(validPacket.status, validPacket.stderr).toBe(0);
      expect(validPacket.stdout).toContain("valid-task-packet");

      const safeRefusal = runInvalidCloseReconcileFunction("safe_refusal", occurrence);
      expect(safeRefusal.status, safeRefusal.stderr).toBe(0);
      expect(safeRefusal.stdout).toContain("reconciled");

      for (const mode of retryableModes) {
        const retryable = runInvalidCloseReconcileFunction(mode, occurrence);
        expect(retryable.status, `${mode}: ${retryable.stderr}`).toBe(1);
      }
    }
  }, 30000);

  it("documents both trusted Phase-2 handoff paths without claiming planner comment publication", () => {
    const docs = source("docs/SUPERVISOR_WORKER_HANDOFF.md");
    expect(docs).toContain("two trusted entry points");
    expect(docs).toContain("workflow_dispatch");
    expect(docs).toContain("immutable source comment ID");
    expect(docs).toContain("re-fetches that owner-authored #548 comment");
    expect(docs).toContain("workflow_call");
    expect(docs).toContain("planner_packet_b64");
    expect(docs).toContain("planner_packet_sha256");
    expect(docs).toContain("planner run ID");
    expect(docs).toContain("planner head SHA");
    expect(docs).toContain("planner workflow ref");
    expect(docs).toContain("passed internally to `supervisor-worker-handoff.yml`");
    expect(docs).toContain("does not publish a Task Packet comment to #548");
    expect(docs).not.toContain("before one Task Packet comment can be published");
  });

  it("serializes durable lifecycle and exact-head check reconciliation without cancellation", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");

    expect(sync).toContain("proffera-worker-lifecycle-");
    expect(sync).toContain("proffera-worker-checks-");
    expect(sync).toContain("cancel-in-progress: false");
    expect((sync.match(/node "\$helper" valid-close-reconcile/g) ?? []).length).toBe(2);
    const helper = source("scripts/supervisor-worker-handoff.mjs");
    expect(helper).toContain("planValidWorkerPrClose");
    expect(helper).toContain("validateTaskStateBinding");
    expect(helper).toContain("activation_task_sha256");
    expect(helper).toContain("terminal_not_converged");
    expect(sync).toContain("Release exact Worker reservation mutex");
    expect(sync).toContain("if: always() && steps.reconcile.outputs.mutex != \'\'");
    expect(sync).toContain("MUTEX: ${{ steps.reconcile.outputs.mutex }}");
    expect(sync).toContain("reservation-mutex-release");
    const lifecycleStart = sync.indexOf("  sync-pr-event:");
    const checkStart = sync.indexOf("  sync-check-state:");
    expect(lifecycleStart).toBeGreaterThanOrEqual(0);
    expect(checkStart).toBeGreaterThan(lifecycleStart);
    const lifecycle = sync.slice(lifecycleStart, checkStart);
    const checkSync = sync.slice(checkStart);
    const lifecycleStep = workflowRunStep(sync, "Record or update Worker lifecycle state in Supervisor issue");
    const reconcileStep = workflowRunStep(sync, "Reconcile required current-head workflow evidence");
    const reconcileAcquire = reconcileStep.indexOf('reservation-mutex-acquire');
    const reconcileOutput = reconcileStep.indexOf('echo "mutex=$mutex" >> "$GITHUB_OUTPUT"', reconcileAcquire);
    const reconcileBind = reconcileStep.indexOf('control_input="$(jq -c --arg mutex "$mutex"', reconcileAcquire);
    expect(reconcileAcquire).toBeGreaterThanOrEqual(0);
    expect(reconcileOutput).toBeGreaterThan(reconcileAcquire);
    expect(reconcileBind).toBeGreaterThan(reconcileOutput);
    expect(lifecycle).toContain("cancel-in-progress: false");
    expect(lifecycle).toContain("id: lifecycle");
    expect(lifecycleStep).toContain('echo "mutex=$mutex" >> "$GITHUB_OUTPUT"');
    expect(lifecycleStep).not.toContain("trap 'release_mutex || true' EXIT");
    expect(lifecycle).toContain("Release exact Worker lifecycle reservation mutex");
    expect(lifecycle).toContain("if: always() && steps.lifecycle.outputs.mutex != ''");
    expect(lifecycle).toContain("MUTEX: ${{ steps.lifecycle.outputs.mutex }}");
    expect(checkSync).toContain("group: proffera-worker-checks-");
    expect(checkSync).toContain("cancel-in-progress: false");
    expect(checkSync).not.toContain("cancel-in-progress: true");
    expect(checkSync).not.toContain("trap 'release_mutex || true' EXIT");
  });
});
