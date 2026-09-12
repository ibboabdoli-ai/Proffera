import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

const helper = resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs");
const ciScopeHelper = resolve(process.cwd(), "scripts/ci-scope-plan.mjs");
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const taskMarker = "<!-- proffera-worker-task-packet:v1 -->";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replaceAll("\r\n", "\n");
}

function executableRunText(workflow: string) {
  const lines = workflow.split("\n");
  const executable: string[] = [];
  let runIndent: number | null = null;
  for (const line of lines) {
    const block = line.match(/^(\s*)run:\s*\|\s*$/);
    if (block) {
      runIndent = block[1].length;
      continue;
    }
    const inline = line.match(/^\s*run:\s*(.+)$/);
    if (inline) {
      executable.push(inline[1]);
      runIndent = null;
      continue;
    }
    if (runIndent !== null) {
      if (line.trim() === "") {
        executable.push(line);
        continue;
      }
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent > runIndent) {
        executable.push(line);
        continue;
      }
      runIndent = null;
    }
  }
  return executable.join("\n");
}

function workflowRunStep(workflow: string, stepName: string) {
  const lines = workflow.split("\n");
  const stepIndex = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  let runIndex = -1;
  for (let index = stepIndex + 1; index < lines.length; index += 1) {
    if (index > stepIndex + 1 && lines[index].trim().startsWith("- name:")) break;
    if (lines[index].trim() === "run: |") {
      runIndex = index;
      break;
    }
  }
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

function packet(overrides: Record<string, unknown> = {}) {
  return {
    task_id: "SUP-TEST-1",
    supervisor_issue: 548,
    repository: "ibboabdoli-ai/Proffera",
    task_title: "Bounded test task",
    task_goal: "Change only the declared test feature.",
    graph_path: "feature/test",
    base_sha: sha,
    branch: "work/proffera-test-task",
    allowed_paths: ["src/features/test/", "tests/test-task.test.ts"],
    forbidden_paths: ["src/features/other/"],
    required_checks: [
      "validate",
      "codeql",
      "targeted-ci-shadow",
      "production-base-health",
      "ai-review",
      "final-gate",
    ],
    risk_class: 2,
    production_mutation_allowed: false,
    merge_allowed: false,
    auto_merge_allowed: false,
    ...overrides,
  };
}

function packetComment(value = packet()) {
  return `${taskMarker}\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      repository: "ibboabdoli-ai/Proffera",
      issue_number: 548,
      actor: "ibboabdoli-ai",
      is_fork: false,
      comment_body: packetComment(),
    },
    supervisor_labels: ["worker-dispatch-enabled"],
    live_main_sha: sha,
    comments: [],
    open_prs: [],
    branch: { exists: false },
    secrets: { openai: true, push: true },
    run_id: "1001",
    ...overrides,
  };
}

function run(mode: string, input: unknown) {
  const result = spawnSync(process.execPath, [helper, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function runText(mode: string, input: unknown) {
  const result = spawnSync(process.execPath, [helper, mode], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function ciPlan(paths: string[]) {
  const result = spawnSync(process.execPath, [ciScopeHelper], {
    input: `${paths.join("\n")}\n`,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function publicationInput(overrides: Record<string, unknown> = {}, currentSourceHead?: string) {
  const path = "docs/SUPERVISOR_WORKER_HANDOFF.md";
  const sourceHead = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const sourceContent = spawnSync("git", ["show", `${sourceHead}:${path}`], { encoding: "utf8" }).stdout;
  const [oldLine, ...rest] = sourceContent.split("\n");
  const newLine = `${oldLine} (publication test)`;
  const content = [newLine, ...rest].join("\n");
  const oldBytes = Buffer.from(sourceContent, "utf8");
  const bytes = Buffer.from(content, "utf8");
  const oldBlobSha = createHash("sha1").update(`blob ${oldBytes.length}\0`).update(oldBytes).digest("hex");
  const gitBlobSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  return {
    packet: packet({ base_sha: sourceHead, allowed_paths: [path], forbidden_paths: ["src/features/other/"] }),
    current_source_head: currentSourceHead ?? sourceHead,
    artifact: {
      source_head: sourceHead,
      artifact_set_complete: "YES",
      paths: [path],
      unified_diff: [`diff --git a/${path} b/${path}`, `index ${oldBlobSha}..${gitBlobSha} 100644`, `--- a/${path}`, `+++ b/${path}`, "@@ -1 +1 @@", `-${oldLine}`, `+${newLine}`, ""].join("\n"),
      replacements: [{ path, content }],
      manifest: [{ path, bytes: bytes.length, lines: content.split("\n").length - 1, sha256: createHash("sha256").update(bytes).digest("hex"), git_blob_sha: gitBlobSha }],
      ...overrides,
    },
  };
}

function evaluate(context: Record<string, unknown>) {
  return run("evaluate", context);
}

function workerPr(overrides: Record<string, unknown> = {}) {
  return {
    number: 900,
    head_ref: "work/proffera-independent",
    head_sha: "c".repeat(40),
    base_ref: "main",
    head_repo: "ibboabdoli-ai/Proffera",
    author: "ibboabdoli-ai",
    body: [
      "Task ID: OTHER-1",
      "Graph path: feature/other",
      'Allowed paths: ["src/features/other/"]',
    ].join("\n"),
    files: ["src/features/other/a.ts"],
    ...overrides,
  };
}

function trustedState(state: string, runId = "1001", headSha = "") {
  return {
    id: 99,
    created_at: "2026-09-08T12:00:00Z",
    user: { login: "github-actions[bot]" },
    body: [
      "<!-- proffera-worker-task-state:SUP-TEST-1 -->",
      "### Supervisor task: SUP-TEST-1",
      `- State: \`${state}\``,
      `- Run ID: \`${runId}\``,
      ...(headSha ? [`- Head: \`${headSha}\``] : []),
    ].join("\n"),
  };
}

function stateBody(state: string, headSha = sha) {
  return [
    "<!-- proffera-worker-task-state:SUP-TEST-1 -->",
    "### Supervisor task: SUP-TEST-1",
    `- State: \`${state}\``,
    "- PR: #900",
    `- Head: \`${headSha}\``,
  ].join("\n");
}

function transition(overrides: Record<string, unknown> = {}) {
  return run("transition", {
    current_body: stateBody("CHECKS_PENDING"),
    source: "lifecycle",
    requested_state: "READY_FOR_SUPERVISOR",
    requested_head: sha,
    live_head: sha,
    live_pr_state: "open",
    live_merged: false,
    ...overrides,
  });
}

describe("Supervisor ↔ Worker Phase-1 handoff", () => {
  it("accepts a valid bounded task", () => {
    expect(evaluate(baseContext()).status).toBe("TASK_CREATED");
  });

  it("rejects malformed task JSON", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = `${taskMarker}\n\`\`\`json\n{broken}\n\`\`\``;
    expect(evaluate(context).code).toBe("malformed_packet");
  });

  it("idempotently refuses a duplicate task ID with active state", () => {
    expect(evaluate(baseContext({ comments: [trustedState("WORKER_PR_OPENED", "1000")] })).status).toBe("ALREADY_DISPATCHED");
  });

  it("allows the same serialized run to recheck its own TASK_CREATED state", () => {
    expect(evaluate(baseContext({ comments: [trustedState("TASK_CREATED")] })).status).toBe("TASK_CREATED");
  });

  it("ignores a spoofed task-state comment not authored by the trusted bot", () => {
    const spoofed = { ...trustedState("WORKER_PR_OPENED", "1000"), user: { login: "attacker" } };
    expect(evaluate(baseContext({ comments: [spoofed] })).status).toBe("TASK_CREATED");
  });

  it("fails closed on an untrusted Worker PR author", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ author: "attacker" })] })).code).toBe("untrusted_worker_pr");
  });

  it("fails closed on an untrusted Worker PR head repository", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ head_repo: "attacker/fork" })] })).code).toBe("untrusted_worker_pr");
  });

  it("fails closed when an open Dependabot PR overlaps the declared scope", () => {
    const bot = workerPr({
      number: 940,
      head_ref: "dependabot/npm_and_yarn/example",
      author: "dependabot[bot]",
      body: "",
      files: ["src/features/test/a.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [bot] })).code).toBe("dependabot_overlap");
  });

  it("rejects a stale base SHA", () => {
    expect(evaluate(baseContext({ live_main_sha: otherSha })).code).toBe("stale_base");
  });

  it("rejects the wrong Supervisor issue", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).issue_number = 549;
    expect(evaluate(context).code).toBe("wrong_supervisor_issue");
  });

  it("rejects an invalid branch", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ branch: "feature/not-worker" }));
    expect(evaluate(context).code).toBe("malformed_packet");
  });

  it("rejects active graph-path ownership collisions", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: 'Task ID: OTHER-1\nGraph path: feature/test\nAllowed paths: ["src/features/other/"]' })] })).code).toBe("graph_collision");
  });

  it("rejects detected changed-file overlap", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ files: ["src/features/test/live.ts"] })] })).code).toBe("file_overlap");
  });

  it("allows a disjoint second writable Worker", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr()] })).status).toBe("TASK_CREATED");
  });

  it("rejects hierarchical graph overlap for a second writable Worker", () => {
    const existing = workerPr({
      body: 'Task ID: OTHER-1\nGraph path: feature/test/subpath\nAllowed paths: ["src/features/other/"]',
    });
    expect(evaluate(baseContext({ open_prs: [existing] })).code).toBe("graph_collision");
  });

  it("fails closed when dispatch would create a third writable Worker", () => {
    const second = workerPr({
      number: 901,
      head_ref: "work/proffera-second",
      body: 'Task ID: OTHER-2\nGraph path: feature/second\nAllowed paths: ["src/features/second/"]',
      files: ["src/features/second/a.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [workerPr(), second] })).code).toBe("writable_worker_limit");
  });

  it("fails closed when a legacy Worker has ambiguous graph ownership", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: "Task/issue: legacy" })] })).code).toBe("ambiguous_graph_owner");
  });

  it("rejects unauthorized/spoofed actors", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).actor = "attacker";
    expect(evaluate(context).code).toBe("unauthorized_actor");
  });

  it("rejects fork or cross-repository sources", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).is_fork = true;
    expect(evaluate(context).code).toBe("fork_source");
  });

  it("kill switch prevents dispatch", () => {
    expect(evaluate(baseContext({ supervisor_labels: [] })).code).toBe("kill_switch_off");
  });

  it("kill switch is isolated from normal CI lifecycle", () => {
    const ci = source(".github/workflows/ci.yml");
    expect(ci).toContain("pull_request:");
    expect(ci).not.toContain("worker-dispatch-enabled");
    expect(ci).not.toContain("Supervisor Worker handoff");
  });

  it("duplicate events update one stable #548 task state instead of appending copies", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(workflow).toContain("proffera-worker-task-state:${task_id}");
    expect(workflow).toContain("--method PATCH");
    expect(sync).toContain("proffera-worker-task-state:${task_id}");
    expect(sync).toContain("--method PATCH");
  });

  it("Worker PR lifecycle still reconciles through exact-head checks", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("WORKER_PR_OPENED");
    expect(sync).toContain("CHECKS_PENDING");
    expect(sync).toContain("READY_FOR_SUPERVISOR");
    expect(sync).toContain("CLOSED_UNMERGED");
    expect(sync).toContain("MERGED");
    expect(sync).toContain('required=("CI" "CodeQL" "Targeted CI shadow" "Production base health")');
    expect(sync).toContain("EVENT_HEAD_SHA");
    expect(sync).toContain('node "$helper" transition');
  });

  it("sensitive or Production permission cannot be granted by a Task Packet", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ production_mutation_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");

    const hardBlocked = baseContext();
    (hardBlocked.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: [".github/workflows/ci.yml"] }));
    expect(evaluate(hardBlocked).code).toBe("malformed_packet");

    const helperBlocked = baseContext();
    (helperBlocked.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: ["scripts/supervisor-worker-handoff.mjs"] }));
    expect(evaluate(helperBlocked).code).toBe("malformed_packet");
  });

  it("blocks the entire .github control-plane scope", () => {
    for (const path of [".github/dependabot.yml", ".github/copilot-instructions.md", ".github/CODEOWNERS"]) {
      const context = baseContext();
      (context.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: [path] }));
      expect(evaluate(context).code).toBe("malformed_packet");
    }
  });

  it("merge and self-approval remain impossible through Task Packet flags and executable workflow paths", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ merge_allowed: true, auto_merge_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");

    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const executable = executableRunText(workflow);
    expect(executable).not.toMatch(/\bgh\s+pr\s+merge\b/i);
    expect(executable).not.toMatch(/enable[-_ ]?auto[-_ ]?merge|enablePullRequestAutoMerge/i);
    expect(executable).not.toMatch(/ibbo-approved/i);
    expect(executable).not.toMatch(/\bgh\s+pr\s+review\b[^\n]*--approve\b/i);
    expect(executable).not.toMatch(/\breviews?\b[^\n]*(?:APPROVE|APPROVED)/i);
  });

  it("preflight exposes secret availability booleans instead of secret values", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const preflight = workflow.slice(0, workflow.indexOf("  dispatch:"));
    expect(preflight).toContain("OPENAI_AVAILABLE: ${{ secrets.OPENAI_API_KEY != '' }}");
    expect(preflight).toContain("PUSH_AVAILABLE: ${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN != '' }}");
    expect(preflight).not.toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(preflight).not.toContain("DISPATCH_PUSH_TOKEN: ${{ secrets.PROFFERA_AUTOFIX_PUSH_TOKEN }}");
  });

  it("uses one complete HEAD-relative Worker snapshot for scope, whitespace, and publication eligibility", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const verify = workflowRunStep(workflow, "Verify Worker diff is nonempty and packet-bounded with immutable helper");
    const commit = workflowRunStep(workflow, "Commit bounded Worker result locally");
    expect(verify).toContain("git add --all --intent-to-add");
    expect(verify).toContain('changed_files="$(git diff --name-only --no-renames HEAD)"');
    expect(verify).toContain('snapshot_file="$RUNNER_TEMP/proffera-worker-changed-files.txt"');
    expect(verify).toContain("git diff --check HEAD");
    expect(commit).toContain('snapshot_file="$RUNNER_TEMP/proffera-worker-changed-files.txt"');
    expect(commit).toContain("diff -u");
    expect(commit).toContain("git diff --check HEAD");
  });

  it("separates lifecycle and check reconciliation concurrency groups", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("proffera-worker-supervisor-sync-${{ github.event_name }}-");
    expect(sync).toContain("cancel-in-progress: false");
  });

  it("fails closed on an invalid trusted Phase-1 lifecycle packet", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    const lifecycleScript = workflowRunStep(sync, "Record or update Worker lifecycle state in Supervisor issue");
    const root = mkdtempSync(join(tmpdir(), "proffera-lifecycle-fail-closed-"));
    const repo = join(root, "repo");
    const bin = join(root, "bin");
    const ghLog = join(root, "gh.log");
    const prJsonFile = join(root, "pr.json");

    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(bin, { recursive: true });
    copyFileSync(helper, join(repo, "scripts", "supervisor-worker-handoff.mjs"));
    writeFileSync(ghLog, "", "utf8");
    writeFileSync(
      prJsonFile,
      JSON.stringify({
        state: "open",
        merged: false,
        user: { login: "ibboabdoli-ai" },
        head: {
          repo: { full_name: "ibboabdoli-ai/Proffera" },
          ref: "work/proffera-test-task",
          sha,
        },
        base: { sha: otherSha },
        body: `${taskMarker}\n\`\`\`json\n{broken}\n\`\`\``,
        html_url: "https://example.invalid/pr/900",
      }),
      "utf8",
    );
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh
if [ "$1" = "api" ] && [ "$2" = "repos/ibboabdoli-ai/Proffera/pulls/900" ]; then
  cat "$PR_JSON_FILE"
  exit 0
fi
printf '%s\n' "$*" >> "$GH_LOG"
exit 0
`,
      { encoding: "utf8", mode: 0o755 },
    );
    writeFileSync(join(bin, "node"), "#!/bin/sh\nexit 42\n", { encoding: "utf8", mode: 0o755 });

    const result = spawnSync("bash", ["-c", lifecycleScript], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.Path ?? process.env.PATH ?? ""}`,
        GH_LOG: ghLog,
        PR_JSON_FILE: prJsonFile,
        GH_TOKEN: "test-token",
        REPOSITORY: "ibboabdoli-ai/Proffera",
        ACTION: "opened",
        PR_NUMBER: "900",
        EVENT_HEAD_SHA: sha,
        ACTOR: "ibboabdoli-ai",
        RUN_ID: "1001",
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Trusted Phase-1 marker carries an invalid Task Packet; refusing legacy fallback.");
    expect(readFileSync(ghLog, "utf8")).toBe("");
    expect(readFileSync(ghLog, "utf8")).not.toContain("proffera-worker-supervisor-event");
  });

  it("materializes an immutable helper before Codex and never executes the Worker checkout helper afterward", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const materialize = workflow.indexOf("Materialize immutable trusted handoff helper outside Worker workspace");
    const codex = workflow.indexOf("Run one bounded implementation Worker");
    const postWorker = workflow.slice(workflow.indexOf("Verify Worker diff", codex));
    expect(materialize).toBeGreaterThan(0);
    expect(materialize).toBeLessThan(codex);
    expect(workflow.slice(materialize, codex)).toContain("$RUNNER_TEMP/proffera-trusted-control");
    expect(workflow.slice(materialize, codex)).toContain("sha256sum --check --status");
    expect(postWorker).not.toContain('helper="scripts/supervisor-worker-handoff.mjs"');
    expect(postWorker).toContain('helper="$RUNNER_TEMP/proffera-trusted-control/supervisor-worker-handoff.mjs"');
    expect(postWorker).toContain("sha256sum --check --status");
  });

  it("Worker tampering with the repository helper cannot change trusted post-Worker validation", () => {
    const dir = mkdtempSync(join(tmpdir(), "proffera-handoff-trust-"));
    const trusted = join(dir, "trusted-helper.mjs");
    const workerCopy = join(dir, "worker-helper.mjs");
    copyFileSync(helper, trusted);
    writeFileSync(workerCopy, 'process.stdout.write(JSON.stringify({ok:true,status:"VALID",code:"bypassed"}));\n', "utf8");

    const input = { packet: packet(), changed_files: ["src/unrelated.ts"] };
    const trustedResult = spawnSync(process.execPath, [trusted, "validate-changes"], {
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    const tamperedResult = spawnSync(process.execPath, [workerCopy, "validate-changes"], {
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    expect(trustedResult.status, trustedResult.stderr).toBe(0);
    expect(JSON.parse(trustedResult.stdout).code).toBe("out_of_scope_change");
    expect(JSON.parse(tamperedResult.stdout).code).toBe("bypassed");
  });

  it("executes the actual Verify Worker diff step with the immutable RUNNER_TEMP helper", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const verifyScript = workflowRunStep(workflow, "Verify Worker diff is nonempty and packet-bounded with immutable helper");
    const root = mkdtempSync(join(tmpdir(), "proffera-handoff-step-"));
    const repo = join(root, "repo");
    const runnerTemp = join(root, "runner");
    const trustedDir = join(runnerTemp, "proffera-trusted-control");
    const repoHelper = join(repo, "scripts", "supervisor-worker-handoff.mjs");
    const trustedHelper = join(trustedDir, "supervisor-worker-handoff.mjs");
    const manifest = join(trustedDir, "supervisor-worker-handoff.sha256");

    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(join(repo, "src"), { recursive: true });
    mkdirSync(trustedDir, { recursive: true });
    copyFileSync(helper, repoHelper);
    copyFileSync(helper, trustedHelper);

    const checksum = spawnSync("sha256sum", [trustedHelper], { encoding: "utf8" });
    expect(checksum.status, checksum.stderr).toBe(0);
    writeFileSync(manifest, checksum.stdout, "utf8");

    for (const args of [
      ["init"],
      ["config", "user.name", "test"],
      ["config", "user.email", "test@example.invalid"],
      ["add", "--all"],
      ["commit", "-m", "baseline"],
    ]) {
      const git = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(git.status, git.stderr).toBe(0);
    }

    writeFileSync(repoHelper, 'process.stdout.write(JSON.stringify({ok:true,status:"VALID",code:"bypassed"}));\n', "utf8");
    writeFileSync(join(repo, "src", "unrelated.ts"), "export const outsideScope = true;\n", "utf8");

    const result = spawnSync("bash", ["-lc", verifyScript], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        RUNNER_TEMP: runnerTemp,
        PACKET_B64: Buffer.from(JSON.stringify(packet())).toString("base64"),
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("hard-blocked path 'scripts/supervisor-worker-handoff.mjs'");
    expect(verifyScript).toContain('helper="$RUNNER_TEMP/proffera-trusted-control/supervisor-worker-handoff.mjs"');
    expect(verifyScript).toContain("sha256sum --check --status");
  });

  it("does not expose OpenAI or push credentials to post-Worker reconciliation helper execution", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const reconcileStart = workflow.indexOf("Reconcile live state again immediately before publication");
    const reconcileEnd = workflow.indexOf("Commit bounded Worker result locally", reconcileStart);
    const reconcile = workflow.slice(reconcileStart, reconcileEnd);
    expect(reconcile).not.toContain("OPENAI_API_KEY");
    expect(reconcile).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");

    const publishStart = workflow.indexOf("Publish branch normally or persist validated recovery artifact");
    const publishEnd = workflow.indexOf("Record dispatched Worker PR", publishStart);
    const publish = workflow.slice(publishStart, publishEnd);
    expect(publish).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(publish).toContain('node "$helper" validate-publication');
    expect(publish).toContain("proffera-publication-recovery-complete");
    expect(publish).toContain('git push --force-with-lease="refs/heads/${BRANCH}:"');
    expect(publish).not.toContain("--force ");
    expect(publish).toContain('echo "recovery_digest=$digest"');
    expect(publish).toContain('echo "recovery_chunks=$total"');

    const recoveryState = workflowRunStep(workflow, "Record persisted recovery artifact in stable Supervisor task state");
    expect(recoveryState).toContain('--arg state "WORKER_BLOCKED"');
    expect(recoveryState).toContain("sha256=${RECOVERY_DIGEST}");
    expect(recoveryState).toContain("chunks=${RECOVERY_CHUNKS:-0}");
    expect(recoveryState).toContain("target_head=${HEAD_SHA}");
  });

  it("wires bounded idempotent recovery and an actionable readiness diagnostic", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(handoff).toContain("Build and validate deterministic publication artifact");
    expect(handoff).toContain("BASE64_GZIP_JSON");
    expect(handoff).toContain("current_source_head:$current_source_head");
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("State body is missing the exact readiness checkpoint");
    expect(sync).toContain("exit 1");
  });

  it("authenticates reservation release and reclaims only verified expired reservations", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const closeStep = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    expect(closeStep).toContain("EVENT_AUTHOR");
    expect(closeStep).toContain("EVENT_HEAD_REPOSITORY");
    expect(closeStep).toContain('reserved_digest" != "$packet_digest');
    expect(closeStep).toContain('reserved_head" != "$live_head');
    expect(workflow).toContain("lease_expires_at");
    expect(workflow).toContain('run_status" = "completed"');
    expect(workflow).toContain('open_pr_count" -eq 0');
    expect(workflow).toContain("reservation changed during stale-run reclamation");
  });

  it("binds reservation publication and recovery to trusted live PR identity", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const enforcement = workflowRunStep(workflow, "Require exact durable reservation before accepting Worker PR");
    const publish = workflowRunStep(workflow, "Mark reservation published");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(enforcement).toContain('live_author" = "${REPOSITORY%%/*}');
    expect(enforcement).toContain('live_head_repository" = "$REPOSITORY');
    expect(enforcement).toContain('state" != "PUBLISHED" ] || [ "$reserved_pr" = "$PR_NUMBER');
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$payload")" = "RESERVED"');
    expect(publish).toContain('test "$(jq -r \'.state\' <<< "$pr")" = "open"');
    expect(recovery).toContain('.head.sha == $head');
    expect(recovery).toContain('.head.repo.full_name == $repo');
    expect(recovery).toContain('.user.login == $owner');
  });

  it("keeps uploaded fallback evidence recoverable and expires it before artifact deletion", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const recovery = workflowRunStep(workflow, "Release or recover reservation on dispatch failure");
    expect(workflow).toContain("id: recovery_upload");
    expect(recovery).toContain('ARTIFACT_UPLOADED" = "true"');
    expect(recovery).toContain("date -u -d '+6 days'");
    expect(workflow).toContain('.recovery.expires_at // ""');
    expect(workflow).toContain("retryable:true");
    expect(workflow).toContain("retention-days: 7");
  });

  it("guards WORKER_PR_OPENED against terminal task-state races", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const record = workflowRunStep(workflow, "Record dispatched Worker PR in stable Supervisor task state");
    expect(record).toContain('requested_state WORKER_PR_OPENED');
    expect(record).toContain('node "$helper" transition');
    expect(record).toContain('current_body:$current_body');
  });

  it("keeps an #830-style independent parallel Worker unaffected", () => {
    const parallel = workerPr({
      number: 830,
      body: 'Task ID: OPS-COST-1\nGraph path: operations/neon-cost\nAllowed paths: ["src/app/api/cron/"]',
      files: ["src/app/api/cron/booking-reminders/route.ts"],
    });
    expect(evaluate(baseContext({ open_prs: [parallel] })).status).toBe("TASK_CREATED");
  });

  it("serializes identical concurrent task deliveries and refuses the second run", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(evaluate(baseContext({ comments: [trustedState("TASK_CREATED", "9999")], run_id: "1001" })).status).toBe("ALREADY_DISPATCHED");
  });

  it("rejects two different task IDs for the same graph path", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr({ body: 'Task ID: OTHER-2\nGraph path: feature/test\nAllowed paths: ["src/features/other/"]' })] })).code).toBe("graph_collision");
  });

  it("rejects main moving between creation and dispatch", () => {
    expect(evaluate(baseContext({ live_main_sha: otherSha })).code).toBe("stale_base");
  });

  it("reuses an already-existing matching task PR instead of creating another", () => {
    const existing = workerPr({
      number: 912,
      head_ref: "work/proffera-test-task",
      body: 'Task ID: SUP-TEST-1\nGraph path: feature/test\nAllowed paths: ["src/features/test/"]',
      files: ["src/features/test/a.ts"],
    });
    const result = evaluate(baseContext({ open_prs: [existing] }));
    expect(result.status).toBe("ALREADY_DISPATCHED");
    expect(result.existing_pr).toBe(912);
  });

  it("rejects a pre-existing branch without trusted task binding", () => {
    expect(evaluate(baseContext({ branch: { exists: true } })).code).toBe("branch_exists");
  });

  it("fails closed when authenticated dispatch capability is missing", () => {
    expect(evaluate(baseContext({ secrets: { openai: false, push: true } })).code).toBe("dispatch_auth_unavailable");
  });

  it("does not redispatch after the source Issue comment is edited", () => {
    const context = baseContext({ comments: [trustedState("CHECKS_PENDING", "9999")] });
    (context.event as Record<string, unknown>).comment_body = `${packetComment()}\nEdited explanatory text.`;
    expect(evaluate(context).status).toBe("ALREADY_DISPATCHED");
  });

  it("closed-unmerged tasks remain terminal until Supervisor chooses a new task ID", () => {
    expect(evaluate(baseContext({ comments: [trustedState("CLOSED_UNMERGED", "9999")] })).status).toBe("ALREADY_DISPATCHED");
  });

  it("terminal MERGED cannot regress", () => {
    const result = transition({
      current_body: stateBody("MERGED"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      live_pr_state: "closed",
      live_merged: true,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("terminal_state_preserved");
  });

  it("terminal CLOSED_UNMERGED cannot regress", () => {
    const result = transition({
      current_body: stateBody("CLOSED_UNMERGED"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      live_pr_state: "closed",
      live_merged: false,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("terminal_state_preserved");
  });

  it("delayed same-head lifecycle events cannot regress READY_FOR_SUPERVISOR", () => {
    const result = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("ready_same_head_regression");
  });

  it("old synchronize events for an old head are rejected", () => {
    const result = transition({
      current_body: stateBody("CHECKS_PENDING", otherSha),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      requested_head: otherSha,
      live_head: sha,
    });
    expect(result.apply).toBe(false);
    expect(result.code).toBe("stale_event_head");
  });

  it("a genuinely new live head invalidates old READY state", () => {
    const result = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR", otherSha),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
      requested_head: sha,
      live_head: sha,
    });
    expect(result.apply).toBe(true);
    expect(result.code).toBe("transition_allowed");
  });

  it("check evidence is exact-live-head bound and can advance current head to READY", () => {
    const stale = transition({
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
      requested_head: otherSha,
      live_head: sha,
    });
    expect(stale.apply).toBe(false);
    expect(stale.code).toBe("stale_event_head");

    const current = transition({
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
      requested_head: sha,
      live_head: sha,
    });
    expect(current.apply).toBe(true);
  });

  it("writes a durable exact-task/exact-head READY checkpoint without merge authority", () => {
    const body = runText("state-body", {
      packet: packet(),
      state: "READY_FOR_SUPERVISOR",
      reason: "All required exact-head evidence is green.",
      run_id: "1001",
      pr_number: 900,
      head_sha: sha,
    });
    expect(body).toContain(`- Ready checkpoint: \`SUP-TEST-1@${sha}\``);
    expect(body).toContain("- Merge allowed: `false`");
    expect(body).toContain("- Auto-merge allowed: `false`");

    const missingHead = spawnSync(process.execPath, [helper, "state-body"], {
      input: JSON.stringify({ packet: packet(), state: "READY_FOR_SUPERVISOR", reason: "unsafe", pr_number: 900 }),
      encoding: "utf8",
    });
    expect(missingHead.status).not.toBe(0);
  });

  it("duplicate lifecycle/check events are idempotent", () => {
    const lifecycle = transition({
      current_body: stateBody("CHECKS_PENDING"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(lifecycle.apply).toBe(false);
    expect(lifecycle.code).toBe("duplicate_event");

    const checks = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
    });
    expect(checks.apply).toBe(false);
    expect(checks.code).toBe("duplicate_event");
  });

  it("delayed concurrent lifecycle execution converges on the newer READY state", () => {
    const first = transition({
      current_body: stateBody("CHECKS_PENDING"),
      source: "checks",
      requested_state: "READY_FOR_SUPERVISOR",
    });
    expect(first.apply).toBe(true);

    const delayed = transition({
      current_body: stateBody("READY_FOR_SUPERVISOR"),
      source: "lifecycle",
      requested_state: "CHECKS_PENDING",
    });
    expect(delayed.apply).toBe(false);
    expect(delayed.code).toBe("ready_same_head_regression");

    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain("concurrency:");
    expect(sync).toContain("Re-fetch live PR and current state immediately before mutation");
    expect(sync).toContain("Re-fetch both live PR and latest workflow evidence immediately before mutation");
  });

  it("CI/review provider availability remains governed by the existing final gate", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    expect(handoff).not.toContain("coderabbitai review");
    expect(handoff).not.toContain("Codex fallback");
    expect(wakeup).toContain("coderabbitai[bot]");
    expect(wakeup).toContain("chatgpt-codex-connector[bot]");
  });

  it("validates the actual Worker diff against allowed, forbidden, hard-blocked, and control helper paths", () => {
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/test/a.ts", "tests/test-task.test.ts"] }).ok).toBe(true);
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/other/a.ts"] }).code).toBe("forbidden_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["package.json"] }).code).toBe("hard_blocked_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["scripts/supervisor-worker-handoff.mjs"] }).code).toBe("hard_blocked_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/unrelated.ts"] }).code).toBe("out_of_scope_change");
  });

  it("accepts only a complete exact-source publication artifact", () => {
    const result = run("validate-publication", publicationInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe("publication_artifact_valid");
  });

  it("requires the normalized Task Packet and canonical scope boundary", () => {
    const input = publicationInput();
    expect(run("validate-publication", { current_source_head: input.current_source_head, artifact: input.artifact }).code).toBe("packet_invalid");
    const forbidden = { ...input, packet: packet({ base_sha: input.current_source_head, allowed_paths: ["docs/SUPERVISOR_WORKER_HANDOFF.md"], forbidden_paths: ["docs/"] }) };
    expect(run("validate-publication", forbidden).code).toBe("packet_invalid");
    const hardBlocked = publicationInput({ paths: ["package.json"] });
    expect(run("validate-publication", hardBlocked).ok).toBe(false);
  });

  it("rejects a unified diff whose result diverges from replacement bytes", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const divergent = String(artifact.unified_diff).replace("(publication test)", "(different diff)");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: divergent } }).code).toBe("diff_replacement_mismatch");
  });

  it("rejects stale-head and incomplete publication artifacts", () => {
    expect(run("validate-publication", publicationInput({}, otherSha)).code).toBe("stale_source_head");
    expect(run("validate-publication", publicationInput({ artifact_set_complete: "NO" })).code).toBe("artifact_incomplete");
  });

  it("rejects missing or discontinuous publication chunks", () => {
    const replacements = [{
      path: "docs/SUPERVISOR_WORKER_HANDOFF.md",
      chunks: [{ number: 1, total: 2, content: "new\n" }],
    }];
    expect(run("validate-publication", publicationInput({ replacements })).code).toBe("missing_chunk");

    const discontinuous = [{
      path: "docs/SUPERVISOR_WORKER_HANDOFF.md",
      chunks: [
        { number: 1, total: 2, content: "ne" },
        { number: 3, total: 2, content: "w\n" },
      ],
    }];
    expect(run("validate-publication", publicationInput({ replacements: discontinuous })).code).toBe("missing_chunk");
  });

  it("rejects publication path-set and digest mismatches", () => {
    expect(run("validate-publication", publicationInput({ paths: ["docs/other.md"] })).code).toBe("out_of_scope_change");
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const manifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    manifest[0].sha256 = "0".repeat(64);
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest } }).code).toBe("digest_mismatch");

    const wrongDiffDigest = String(artifact.unified_diff).replace(String((artifact.manifest as Array<Record<string, unknown>>)[0].git_blob_sha), "2".repeat(40));
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: wrongDiffDigest } }).code).toBe("digest_mismatch");
  });

  it("rejects replacement byte and line count mismatches", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const byteManifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    byteManifest[0].bytes = 3;
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest: byteManifest } }).code).toBe("byte_count_mismatch");

    const lineManifest = structuredClone(artifact.manifest) as Array<Record<string, unknown>>;
    lineManifest[0].lines = 2;
    expect(run("validate-publication", { ...input, artifact: { ...artifact, manifest: lineManifest } }).code).toBe("line_count_mismatch");
  });

  it("rejects a truncated unified-diff hunk", () => {
    const input = publicationInput();
    const artifact = input.artifact as Record<string, unknown>;
    const truncated = String(artifact.unified_diff).replace("@@ -1 +1 @@", "@@ -1 +1,2 @@");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: truncated } }).code).toBe("diff_incomplete");

    const falseDeletion = String(artifact.unified_diff).replace("+++ b/docs/SUPERVISOR_WORKER_HANDOFF.md", "+++ /dev/null");
    expect(run("validate-publication", { ...input, artifact: { ...artifact, unified_diff: falseDeletion } }).code).toBe("diff_incomplete");
  });

  it("preserves deletion, rename, and missing-final-newline artifact semantics", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-publication-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "delete.txt"), "first\nsecond\n", "utf8");
    writeFileSync(join(repo, "rename.txt"), "renamed\n", "utf8");
    writeFileSync(join(repo, "newline.txt"), "before\n", "utf8");
    git("add", "--all");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    git("rm", "delete.txt");
    git("mv", "rename.txt", "renamed.txt");
    writeFileSync(join(repo, "newline.txt"), "after", "utf8");
    git("commit", "-am", "target");
    const targetHead = git("rev-parse", "HEAD");
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: ["delete.txt", "rename.txt", "renamed.txt", "newline.txt"] });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    const replacements = artifact.replacements as Array<Record<string, unknown>>;
    const manifest = artifact.manifest as Array<Record<string, unknown>>;
    expect(replacements.find((entry) => entry.path === "delete.txt")).toEqual({ path: "delete.txt", deleted: true });
    expect(replacements.find((entry) => entry.path === "rename.txt")).toEqual({ path: "rename.txt", deleted: true });
    expect(manifest.find((entry) => entry.path === "delete.txt")).toMatchObject({ deleted: true, bytes: 0, lines: 0, git_blob_sha: "0".repeat(40) });
    expect(String(artifact.unified_diff)).toContain("\\ No newline at end of file");
    const validate = (candidate: Record<string, unknown>) => {
      const result = spawnSync(process.execPath, [helper, "validate-publication"], {
        cwd: repo,
        input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, artifact: candidate }),
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    expect(validate(artifact).ok).toBe(true);

    const deleteSection = String(artifact.unified_diff).match(/diff --git a\/delete\.txt[\s\S]*?(?=diff --git |$)/)?.[0] ?? "";
    const partialSection = deleteSection.replace("@@ -1,2 +0,0 @@\n-first\n-second\n", "@@ -1 +0,0 @@\n-first\n");
    for (const section of [
      partialSection,
      deleteSection.replace("@@ -1,2 +0,0 @@\n-first\n-second\n", "@@ -1,2 +1 @@\n first\n-second\n"),
    ]) {
      const invalid = structuredClone(artifact) as Record<string, unknown>;
      invalid.unified_diff = String(artifact.unified_diff).replace(deleteSection, section);
      expect(validate(invalid).code).toBe("diff_source_mismatch");
    }

    writeFileSync(join(repo, "delete.txt"), "single", "utf8");
    git("add", "delete.txt");
    git("commit", "-m", "newline-less source");
    const noNewlineSource = git("rev-parse", "HEAD");
    git("rm", "delete.txt");
    git("commit", "-m", "delete newline-less source");
    const noNewlineTarget = git("rev-parse", "HEAD");
    const noNewlinePacket = packet({ base_sha: noNewlineSource, allowed_paths: ["delete.txt"] });
    const noNewlineBuild = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: noNewlinePacket, source_head: noNewlineSource, target_head: noNewlineTarget }),
      encoding: "utf8",
    });
    expect(noNewlineBuild.status, noNewlineBuild.stderr).toBe(0);
  });

  it("accepts exact header-only empty-file additions and deletions", () => {
    const repo = mkdtempSync(join(tmpdir(), "proffera-empty-publication-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "delete-empty.txt"), "", "utf8");
    git("add", "delete-empty.txt");
    git("commit", "-m", "source");
    const sourceHead = git("rev-parse", "HEAD");
    git("rm", "delete-empty.txt");
    writeFileSync(join(repo, "add-empty.txt"), "", "utf8");
    git("add", "add-empty.txt");
    git("commit", "-m", "target");
    const targetHead = git("rev-parse", "HEAD");
    const scopedPacket = packet({ base_sha: sourceHead, allowed_paths: ["add-empty.txt", "delete-empty.txt"] });
    const built = spawnSync(process.execPath, [helper, "build-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, source_head: sourceHead, target_head: targetHead }),
      encoding: "utf8",
    });
    expect(built.status, built.stderr).toBe(0);
    const artifact = JSON.parse(built.stdout) as Record<string, unknown>;
    expect(String(artifact.unified_diff)).not.toContain("@@ ");
    const validated = spawnSync(process.execPath, [helper, "validate-publication"], {
      cwd: repo,
      input: JSON.stringify({ packet: scopedPacket, current_source_head: sourceHead, artifact }),
      encoding: "utf8",
    });
    expect(validated.status, validated.stderr).toBe(0);
    expect(JSON.parse(validated.stdout).ok).toBe(true);
  });

  it("keeps sensitive work on FULL gates and permits canonical low-risk routing", () => {
    const sensitive = ciPlan([".github/workflows/worker-supervisor-sync.yml"]);
    expect(sensitive.classification).toBe("restricted-full");
    expect(sensitive.fullCiStillRequired).toBe(true);
    expect(sensitive.proposedLanes).toEqual(["governance", "whitespace", "lint", "typecheck", "unit", "build", "e2e", "discovery-worker"]);

    const docs = ciPlan(["docs/example.md"]);
    expect(docs.classification).toBe("low-docs");
    expect(docs.fullCiStillRequired).toBe(false);

    const isolatedTest = ciPlan(["tests/example.test.ts"]);
    expect(isolatedTest.classification).toBe("low-mapped");
    expect(isolatedTest.fullCiStillRequired).toBe(false);
  });

  it("uses the existing pinned Codex action but never exposes the push credential to that action", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).toContain("openai/codex-action@86365089eb2b84e0a8fb0717b304f8bdcb13b20e");
    const codexStart = workflow.indexOf("Run one bounded implementation Worker");
    const codexEnd = workflow.indexOf("Verify Worker diff", codexStart);
    const codexBlock = workflow.slice(codexStart, codexEnd);
    expect(codexBlock).toContain("OPENAI_API_KEY");
    expect(codexBlock).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
  });
});
