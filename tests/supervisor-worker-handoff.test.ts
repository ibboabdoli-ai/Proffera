import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const helper = resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs");
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const taskMarker = "<!-- proffera-worker-task-packet:v1 -->";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
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

  it("accepts an independent graph path with disjoint declared scope", () => {
    expect(evaluate(baseContext({ open_prs: [workerPr()] })).status).toBe("TASK_CREATED");
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

  it("does not expose OpenAI or push credentials to post-Worker reconciliation helper execution", () => {
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    const reconcileStart = workflow.indexOf("Reconcile live state again immediately before publication");
    const reconcileEnd = workflow.indexOf("Commit bounded Worker result locally", reconcileStart);
    const reconcile = workflow.slice(reconcileStart, reconcileEnd);
    expect(reconcile).not.toContain("OPENAI_API_KEY");
    expect(reconcile).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");

    const publishStart = workflow.indexOf("Publish branch atomically and open one PR");
    const publishEnd = workflow.indexOf("Record dispatched Worker PR", publishStart);
    const publish = workflow.slice(publishStart, publishEnd);
    expect(publish).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(publish).not.toContain('node "$helper"');
    expect(publish).not.toContain("scripts/supervisor-worker-handoff.mjs");
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
