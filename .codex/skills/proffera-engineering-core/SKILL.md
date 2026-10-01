---
name: proffera-engineering-core
description: "Use for Proffera engineering implementation, repair, validation, and delivery planning. Orchestrates the repository's existing Graph Engineering, deterministic decision router, Failure Memory, metrics, and review gates without replacing their authority."
---

# Proffera Engineering Core

Use this skill to execute Proffera engineering work consistently. It is an orchestration guide only. It does **not** grant authorization, mutate Production, dispatch workers, rerun jobs, merge PRs, call providers, or replace repository control-plane code.

## Authority order

Always obey the live repository and canonical controls before this skill:

1. `AGENTS.md`
2. `WORKER_BOOTSTRAP.md`
3. Supervisor issue `#548` and its bot-maintained live-state comment
4. executable tests/workflows and current GitHub state
5. this skill

If this skill conflicts with any source above, the source above wins.

## Deterministic inputs

Do not improvise risk, routing, retry, or failure semantics. Reuse the existing pure contracts:

- `scripts/supervisor-decision-router.mjs` — task type, safety risk, reasoning difficulty, capabilities, route metadata, and human-authorization decision.
- `scripts/supervisor-failure-memory.mjs` — bounded failure/strategy history and durable retry-intent contract.
- `scripts/supervisor-metrics.mjs` — observation-only delivery metrics and repeated-failure evidence.
- `.codex/skills/graphify/SKILL.md` — architecture/dependency support when the graph is relevant.

These modules are evidence/decision contracts. They do not themselves authorize side effects.

## Core loop

### 1. Reconcile live state

Before editing:

- resolve current `main`;
- inspect open PRs and existing graph ownership;
- reuse existing work instead of opening a duplicate lane;
- verify the current task is still `PARTIAL`, `BROKEN`, or `MISSING`;
- keep Production/runtime evidence separate from source-code inference.

### 2. Build the graph

Identify:

- entry node;
- source-of-truth node;
- execution path;
- downstream nodes;
- preserved invariants;
- maximum plausible blast radius.

For cross-node architecture/caller/callee work, use Graphify when its graph is sufficiently current, then verify conclusions in source/live evidence.

### 3. Create the deterministic decision artifact

Classify the work with all fields required by the deterministic schema:

- `schema_version: 1`;
- `task_type`;
- `risk_class` from 1 to 4;
- `reasoning_difficulty`;
- required `capabilities`.

Example shape:

```json
{
  "schema_version": 1,
  "task_type": "bugfix",
  "risk_class": 2,
  "reasoning_difficulty": "complex",
  "capabilities": ["repository_write", "test_execution"]
}
```

Normalize that artifact through `scripts/supervisor-decision-router.mjs`.

Never lower risk to obtain autonomous execution. `control_plane`, migration/schema, workflow/security-sensitive, Production-mutation, and external-side-effect work must remain fail-closed according to the router result.

If `requires_human_authorization=true`, stop autonomous implementation at the relevant authorization boundary. A model choice, worker availability, or user urgency does not override this.

### 4. Choose the existing execution route

Use the router's existing route IDs only:

- `worker`;
- `review_repair`;
- `ci_autofix`.

Do not create a second repair engine, planner, Final Gate, review policy, or model router.

The router records the currently supported pinned Codex action and truthful model semantics. Do not invent a concrete model name when the workflow does not pass one.

### 5. Check failure history before retry

For repair/retry work, inspect the task-scoped Failure Memory evidence when available.

Do not repeat the same material failure + same strategy blindly. Respect:

- failure fingerprint;
- strategy fingerprint;
- stop condition;
- re-entry condition;
- durable retry intent state.

Missing or pruned history is not proof that no prior attempt occurred. Ambiguous retry state fails closed.

### 6. Implement the smallest root-cause patch

Follow the Task Packet and graph lock:

- one writable owner per graph path;
- minimum files/nodes needed;
- no speculative refactor;
- no unrelated cleanup;
- preserve tenant/auth/privacy/payment/Directory/Production invariants;
- no direct `main` edits.

### 7. Validate progressively

Run nearest checks first, then broaden according to touched risk:

1. syntax/type correctness;
2. targeted tests;
3. relevant integration/PostgreSQL/browser behavior;
4. lint/build;
5. required CI/CodeQL/E2E/Production-base-health delivery gates.

Do not treat a build, mocked unit test, or review comment as runtime proof.

### 8. Red Team before publication

Challenge the complete intended diff for:

- stale-head/evidence races;
- duplicate side effects;
- lost updates and lock ordering;
- retry loops;
- fail-open authorization/privacy/publication;
- cross-tenant leakage;
- tests that mock away the real failure edge;
- recovery dead ends;
- sibling paths using the same policy/authority.

Fix verified findings in one coherent batch when practical.

### 9. Publish and review on exact head

After publication:

- bind all review/CI evidence to the exact current head;
- let review bursts settle before batching valid repairs;
- do not accept stale review evidence;
- do not weaken gates to make the PR green;
- do not merge without the repository's required exact-head human authorization.

### 10. Measure and report

Use `scripts/supervisor-metrics.mjs` when delivery-process evidence matters. Separate:

- requested;
- running;
- reviewed;
- implemented;
- tested;
- published;
- merged;
- deployed/Production-verified.

Report the remaining blocker and next authorized action. Never call work complete while a required acceptance criterion is unverified.

## Explicit non-goals

This skill must never be used to:

- bypass Task Packet provenance, graph ownership, branch rules, review, or Final Gate;
- self-authorize Class 3/4 work;
- self-approve merge;
- mutate Production, Neon/Vercel/QStash/config/secrets without the required approval;
- fabricate official-source, provider, customer, Marketplace, or review evidence;
- duplicate canonical rules into a competing orchestration system.
