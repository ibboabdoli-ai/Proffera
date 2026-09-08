import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const helper = resolve(process.cwd(), "scripts/supervisor-worker-handoff.mjs");
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const taskMarker = "<!-- proffera-worker-task-packet:v1 -->";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
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

function trustedState(state: string, runId = "1001") {
  return {
    id: 99,
    created_at: "2026-09-08T12:00:00Z",
    user: { login: "github-actions[bot]" },
    body: [
      "<!-- proffera-worker-task-state:SUP-TEST-1 -->",
      "### Supervisor task: SUP-TEST-1",
      `- State: \`${state}\``,
      `- Run ID: \`${runId}\``,
    ].join("\n"),
  };
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
  });

  it("sensitive or Production permission cannot be granted by a Task Packet", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ production_mutation_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");

    const hardBlocked = baseContext();
    (hardBlocked.event as Record<string, unknown>).comment_body = packetComment(packet({ allowed_paths: [".github/workflows/ci.yml"] }));
    expect(evaluate(hardBlocked).code).toBe("malformed_packet");
  });

  it("merge and self-approval remain impossible through Task Packet flags", () => {
    const context = baseContext();
    (context.event as Record<string, unknown>).comment_body = packetComment(packet({ merge_allowed: true, auto_merge_allowed: true }));
    expect(evaluate(context).code).toBe("malformed_packet");
    const workflow = source(".github/workflows/supervisor-worker-handoff.yml");
    expect(workflow).not.toContain("gh pr merge");
    expect(workflow).not.toContain("ibbo-approved");
    expect(workflow).not.toContain("enable-auto-merge");
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

  it("new Worker commits invalidate readiness by routing synchronize to CHECKS_PENDING", () => {
    const sync = source(".github/workflows/worker-supervisor-sync.yml");
    expect(sync).toContain('elif [ "$ACTION" = "synchronize" ] || [ "$ACTION" = "ready_for_review" ]; then');
    expect(sync).toContain('state="CHECKS_PENDING"');
  });

  it("CI/review provider availability remains governed by the existing final gate", () => {
    const handoff = source(".github/workflows/supervisor-worker-handoff.yml");
    const wakeup = source(".github/workflows/proffera-final-gate-wakeup.yml");
    expect(handoff).not.toContain("coderabbitai review");
    expect(handoff).not.toContain("Codex fallback");
    expect(wakeup).toContain("coderabbitai[bot]");
    expect(wakeup).toContain("chatgpt-codex-connector[bot]");
  });

  it("validates the actual Worker diff against allowed, forbidden, and hard-blocked paths", () => {
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/test/a.ts", "tests/test-task.test.ts"] }).ok).toBe(true);
    expect(run("validate-changes", { packet: packet(), changed_files: ["src/features/other/a.ts"] }).code).toBe("forbidden_change");
    expect(run("validate-changes", { packet: packet(), changed_files: ["package.json"] }).code).toBe("hard_blocked_change");
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
