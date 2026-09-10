# Supervisor ↔ Worker Phase-1 handoff

This document describes the bounded repository control-plane handoff between the Proffera Supervisor and implementation Workers. GitHub issue #548 remains the live control board; `AGENTS.md`, `WORKER_BOOTSTRAP.md`, current `main`, required CI, CodeQL, CodeRabbit/fallback policy, and Final Gate remain authoritative.

## Scope

Phase 1 automates only the handoff layer:

`Supervisor-selected task → durable Task Packet → guarded Worker dispatch → Worker PR → existing validation/review gates → durable reconciliation into #548`.

It does **not** select roadmap work, approve PRs, apply `ibbo-approved`, merge, enable auto-merge, deploy, mutate Production, or replace existing CI/review systems.

## Task Packet

A task is created by the repository owner posting or editing a comment on Supervisor issue #548 containing exactly one marker and exactly one fenced JSON object:

````text
<!-- proffera-worker-task-packet:v1 -->
```json
{
  "task_id": "SUP-EXAMPLE-1",
  "supervisor_issue": 548,
  "repository": "ibboabdoli-ai/Proffera",
  "task_title": "Example bounded task",
  "task_goal": "Describe the observable implementation outcome.",
  "graph_path": "example/subsystem",
  "base_sha": "<exact 40-character current main SHA>",
  "branch": "work/proffera-example-task",
  "allowed_paths": ["src/example/", "tests/example.test.ts"],
  "forbidden_paths": ["src/unrelated/"],
  "required_checks": [
    "validate",
    "codeql",
    "targeted-ci-shadow",
    "production-base-health",
    "ai-review",
    "final-gate"
  ],
  "risk_class": 2,
  "production_mutation_allowed": false,
  "merge_allowed": false,
  "auto_merge_allowed": false
}
```
````

`task_id` is the durable identity. A retry with the same ID never creates a second Worker when a trusted active/terminal task state, matching PR, or ambiguous pre-existing branch exists.

## Trust and fail-closed rules

Issue/comment text is data, not authority. Dispatch accepts only an owner-authored packet on issue #548 for `ibboabdoli-ai/Proffera`. The parser validates task IDs, exact base SHA, safe branch syntax, safe repository-relative path scopes, required checks, risk class, and all three mutation/merge flags as literal `false`.

The generic dispatcher additionally hard-blocks merge/control-plane authorization, workflow, environment/secret, migration/schema, and package/lockfile paths. A Task Packet cannot weaken this boundary by declaring those paths allowed.

Before dispatch and again immediately before publication, the workflow resolves live `main`, the kill switch, all open `work/proffera-*` PRs, changed files, task/graph metadata, and existing branch/task state. It fails closed when:

- the packet is malformed, stale, from the wrong actor/repository/issue, or missing boundaries;
- authenticated Codex or branch-publication capability is unavailable;
- the task ID is already active or terminal;
- the target branch already exists without a trusted matching task PR;
- another Worker owns the same graph path;
- declared or observed file scope overlaps an active Worker;
- a legacy Worker lacks enough graph/scope metadata to prove independence;
- an open Dependabot PR overlaps the requested file scope;
- live `main` moves between packet creation and publication;
- the Worker changes a forbidden, hard-blocked, or undeclared file.

## Actual Worker execution

Phase 1 reuses the repository-supported Codex GitHub Action already used by Proffera CI repair. It does not introduce a second orchestrator or external queue.

The handoff workflow calls the same immutable `openai/codex-action` revision with the existing `OPENAI_API_KEY`. The action receives no branch-push credential. It works in the checked-out workspace, treats the Task Packet and repository text as untrusted input, and is instructed not to commit, push, deploy, merge, approve, mutate Production, or install packages.

After the Worker returns, repository code validates the actual changed-file set against the packet and then runs lint, typecheck, tests, build, and `git diff --check`. The workflow then repeats freshness/overlap/kill-switch checks. Only after all of those checks pass is a local commit created and published using the repository's existing `PROFFERA_AUTOFIX_PUSH_TOKEN`, followed by one PR creation. Missing or insufficient existing authentication fails closed and is recorded as `WORKER_BLOCKED`; no successful-dispatch claim is fabricated.

## Kill switch

Dispatch is **disabled by default**. Supervisor issue #548 must carry the label:

`worker-dispatch-enabled`

Removing that label immediately disables new dispatch and also blocks a Worker that reaches the pre-publication recheck. This switch affects only Supervisor-to-Worker dispatch; normal PR CI, CodeQL, CodeRabbit, Final Gate, and merge authorization continue unchanged. GitHub issue label history provides the audit trail.

After enabling the label, create or edit the intended Task Packet comment to trigger dispatch. Removing the label never disables validation of already-open PRs.

## Durable state and idempotency

Each valid `task_id` owns one stable bot-authored #548 comment:

`<!-- proffera-worker-task-state:<task_id> -->`

Automation updates that comment in place instead of appending duplicate task-state comments. States include:

- `TASK_CREATED`
- `TASK_BLOCKED`
- `WORKER_PR_OPENED`
- `CHECKS_PENDING`
- `READY_FOR_SUPERVISOR`
- `WORKER_BLOCKED`
- `CLOSED_UNMERGED`
- `MERGED`

The handoff workflow uses one non-cancelling Supervisor concurrency group, so identical or graph-conflicting deliveries are serialized. A second run sees the first trusted task state and returns an already-dispatched result rather than creating another branch or PR. `TASK_BLOCKED` may be re-evaluated because no Worker was started; once a Worker-active/terminal state exists, the same task ID is not dispatched again.

Malformed packets that do not provide a usable task ID receive one rejection record keyed by the source comment ID.

## Worker → Supervisor reconciliation

`worker-supervisor-sync.yml` preserves the legacy PR event trail for pre-Phase-1 Workers. For a trusted Phase-1 Worker PR, it parses the embedded packet and updates the stable task-state record.

A new commit routes the task back to `CHECKS_PENDING`, invalidating earlier head-specific evidence. Workflow completion events for the exact current head reconcile the existing required evidence from:

- CI;
- CodeQL;
- Targeted CI shadow;
- Production base health.

Only when all four current-head workflow runs are successful does the task become `READY_FOR_SUPERVISOR`. CI success still includes the repository's existing final browser/review gate, so this reconciliation does not create a parallel review system.

## Human approval boundary

Phase 1 never provides merge authorization. It does not add/remove `ibbo-approved`, submit an owner `APPROVED` review, merge, or enable auto-merge. Existing exact-head human approval rules remain unchanged, and any new commit continues to invalidate stale review/approval evidence according to current Proffera governance.

## Recovery

The automation prefers refusing duplicate work over guessing:

- stale packet → Supervisor issues a fresh packet with the correct baseline;
- graph/path ambiguity → wait for or reconcile the owning PR, then retry;
- kill switch off → enable the label deliberately, then edit/repost the intended packet;
- Worker produced no safe diff → task becomes blocked;
- branch exists without a trustworthy PR binding → manual Supervisor review is required;
- publication/authentication fails after local implementation → task becomes `WORKER_BLOCKED`; a retry cannot silently create a second Worker;
- PR closes unmerged → `CLOSED_UNMERGED`; a new attempt requires a new Supervisor-selected task identity;
- main moves before publish → Worker output is not published; Supervisor creates a fresh-baseline task.

No separate database, queue, SaaS orchestrator, Production service, or provider mutation is required for Phase 1.
