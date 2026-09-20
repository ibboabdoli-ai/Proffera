import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
    const routerHeader = router.slice(0, router.indexOf("jobs:"));
    expect(routerHeader).toContain("cancel-in-progress: false");
    expect(routerHeader).not.toContain("cancel-in-progress: true");
    expect(routerHeader).toContain("github.event.comment.id");
    expect(routerHeader).toContain("github.event.review.id");

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
    expect(planner).toContain("planner_packet_sha256");
    expect(planner).toContain("planner_run_id");
    expect(planner).toContain("planner_head_sha");
    expect(planner).toContain("planner_packet_sha256");
    expect(planner).toContain("planner_workflow_ref");
    expect(planner).toContain("uses: ./.github/workflows/supervisor-worker-handoff.yml");
    expect(planner).not.toContain("gh workflow run supervisor-worker-handoff.yml");
    expect(planner).toContain("active_state_ids");
    expect(planner).toContain("active_pr_ids");
    expect(planner).toContain("sort -u");
    expect(planner).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(planner).not.toContain('POST "repos/${REPOSITORY}/issues/548/comments"');
    const plannerValidationStart = planner.indexOf("Validate planner output against live state");
    const plannerDispatchStart = planner.indexOf("\n  dispatch:", plannerValidationStart);
    const plannerValidation = planner.slice(plannerValidationStart, plannerDispatchStart);
    expect(plannerValidation).toContain("PLANNER_RUN_ID: ${{ github.run_id }}");
    expect(plannerValidation).toContain("PLANNER_WORKFLOW_REF: ${{ github.workflow_ref }}");

    const workflowCall = handoff.slice(handoff.indexOf("  workflow_call:"), handoff.indexOf("  workflow_dispatch:"));
    const manualDispatch = handoff.slice(handoff.indexOf("  workflow_dispatch:"), handoff.indexOf("  pull_request_target:"));
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
    const plannerJob = planner.slice(planner.indexOf("  plan:"), planner.indexOf("  dispatch:"));
    expect(plannerJob).toContain("group: proffera-supervisor-planner-plan");
    expect(plannerJob).toContain("cancel-in-progress: true");
    expect(plannerJob).toContain("issues: read");
    expect(plannerJob).not.toContain("issues: write");
    const plannerDispatchJob = planner.slice(planner.indexOf("  dispatch:"));
    expect(plannerDispatchJob).toContain("issues: write");
    expect(handoff).not.toContain("needs.dispatch.outputs.reservation_comment_id");
    expect(handoff).toContain("if: failure() && needs.preflight.outputs.reservation_comment_id != \'\'");
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
  it("isolates trusted review-repair publication from untrusted model and repository execution", () => {
    const repair = source(".github/workflows/supervisor-review-repair.yml");

    expect(repair).toContain("sleep 45");
    expect(repair).toContain("Qualify current-head material findings before model repair");
    expect(repair).toContain("current_inline");
    expect(repair).toContain("blocking_reviews");
    expect(repair).toContain("steps.qualify.outputs.repair == 'yes'");
    expect(repair).toContain("consecutive");
    expect(repair).toContain("[review-repair]");
    const publishStart = repair.indexOf("  publish:");
    expect(publishStart).toBeGreaterThan(0);
    const untrustedRepairJob = repair.slice(0, publishStart);
    const trustedPublishJob = repair.slice(publishStart);
    expect(untrustedRepairJob).toContain("Run one batched exact-head repair");
    expect(untrustedRepairJob).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(untrustedRepairJob).not.toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(untrustedRepairJob).not.toContain("validate-changes");
    expect(trustedPublishJob).toContain("actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0");
    expect(trustedPublishJob).toContain("Materialize trusted repair helper in isolated publish job");
    expect(trustedPublishJob).toContain("git hash-object");
    expect(trustedPublishJob).toContain("validate-changes");
    expect(trustedPublishJob).toContain("PROFFERA_AUTOFIX_PUSH_TOKEN");
    expect(trustedPublishJob.indexOf("validate-changes")).toBeLessThan(trustedPublishJob.indexOf("PROFFERA_AUTOFIX_PUSH_TOKEN"));
    expect(repair).not.toContain("--force");
  });
  it("trusted review-repair validation rejects checkout-helper tampering and out-of-scope writes", () => {
    const trustedSource = resolve(root, "scripts/supervisor-worker-handoff.mjs");
    const dir = mkdtempSync(join(tmpdir(), "proffera-review-repair-trust-"));
    const trusted = join(dir, "trusted-helper.mjs");
    const compromised = join(dir, "workspace-helper.mjs");
    copyFileSync(trustedSource, trusted);
    writeFileSync(compromised, '#!/usr/bin/env node\nprocess.stdin.resume(); process.stdin.on("end", () => process.stdout.write(JSON.stringify({ok:true})));\n');

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
    const forged = spawnSync(process.execPath, [compromised], { input, encoding: "utf8" });
    expect(forged.status, forged.stderr).toBe(0);
    expect(JSON.parse(forged.stdout).ok).toBe(true);

    const verified = spawnSync(process.execPath, [trusted, "validate-changes"], { input, encoding: "utf8" });
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ ok: false, code: "out_of_scope_change" });
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
