# Proffera Worker Protocol — Graph Engineering

This file is authoritative for every AI worker, coding agent, reviewer, and automation operating in this repository.

The default operating model is **Graph Engineering**: understand the project as a dependency graph, identify the smallest safe path through that graph, change only the necessary nodes, validate affected edges, and stop when the requested outcome is proven.

## 1. Core operating principles

1. **Use first, code later.**
   - Inspect and reproduce the real user-visible problem before changing code.
   - Do not implement speculative features or fixes.
   - If no observable problem or explicit requirement exists, do not modify code.

2. **Map before modifying.**
   - Treat pages, components, APIs, database tables, jobs, configuration, authentication, deployment, and external integrations as nodes.
   - Treat imports, calls, data flows, redirects, permissions, events, and deployment dependencies as edges.
   - Identify upstream causes, downstream consumers, invariants, and failure propagation before editing.

3. **Choose the shortest safe path.**
   - Prefer the smallest reversible change that solves the verified problem.
   - Avoid broad refactors, unrelated cleanup, architectural rewrites, and “while we are here” changes.
   - Preserve existing behavior outside the explicit scope.

4. **Evidence over assumptions.**
   - Every conclusion must be grounded in repository evidence, runtime behavior, logs, tests, or an explicit user instruction.
   - Never claim something is fixed, deployed, merged, or verified without direct evidence.

5. **One controlled loop at a time.**
   - Complete analysis, implementation, validation, and reporting for the current graph path before starting another path within the same worker lane.
   - Do not jump phases or open multiple competing implementations for the same graph path.
   - This rule does **not** prohibit simultaneous writable PRs on independent graph paths when their touch sets, source-of-truth nodes, invariants, and merge order do not materially conflict.

---

## 1A. Fast autonomous execution overlay

This overlay is mandatory for implementation work. It exists to reduce PR churn and external-review repair loops without weakening Graph Engineering, tenant safety, Production safety, or exact-head delivery gates.

### Roles

Use three logical roles only:

- **Supervisor** — resolves current `main`, active PRs, dependencies and graph locks; prepares the task packet; serializes merge decisions; releases the lock after verified completion.
- **Builder** — owns the single writable implementation for one graph path; researches, implements, tests and repairs that path.
- **Verifier / Red Team** — reviews the proposed diff and evidence independently before the first push. It must challenge assumptions rather than defend the Builder's design.

A Builder may use parallel read-only research passes or subagents for separate questions, but there is still only one writable implementation owner for the graph path.

### Supervisor task packet

Before implementation, the Supervisor should reduce broad project context into the smallest complete packet needed for the task:

```text
Goal: <observable outcome>
Baseline: <current 40-character main SHA>
Graph path: <single bounded dependency path>
Touch set: <expected files/directories/tables/routes/workflows>
Depends on: <PR/issue/none>
Preserved invariants: <behavior that must not change>
Acceptance criteria: <observable pass conditions>
Forbidden areas: <out-of-scope/high-risk nodes>
Merge/deploy authority: <authorized / not authorized / standing scope>
```

Workers must still read the canonical sources required by `WORKER_BOOTSTRAP.md`, but should not repeatedly re-analyze unrelated project areas once the current task packet and graph are proven sufficient.

### Pre-push Red Team gate

Before the first implementation push, perform an independent adversarial review of the complete intended diff, relevant tests and graph assumptions. At minimum check for:

- race conditions and lost-update behavior;
- stale state/evidence surviving a failure path;
- retry loops, unbounded polling or repeated external calls;
- missing idempotency or duplicate side effects;
- fail-open authorization, entitlement, privacy or publication behavior;
- tenant/workspace identity accepted from the wrong boundary;
- duplicated contracts/helpers instead of the canonical source of truth;
- tests that mock away the actual failure edge;
- test schema/DDL that can drift from canonical migrations;
- recovery dead-ends where a reversible state can never become eligible again;
- hidden downstream API/SEO/Search/Marketplace exposure.

Valid findings are fixed **before** the primary push whenever practical, and the nearest relevant checks are rerun.

For **Class 3/4 work**, or work that would match the repository's sensitive/large AI-review routing, one local CodeRabbit CLI review may be used as an additional pre-push adversarial pass **after** targeted validation and the internal Red Team, provided the CLI is already installed and authenticated. Use `cr review --agent --base main`, verify every finding against the current graph and repository invariants, fix only verified critical/major issues, rerun affected checks, and allow at most two CLI passes for the same bounded task. This local CLI pass is development feedback only; it never replaces or satisfies the required final current-head PR review gate. If the CLI is unavailable or unauthenticated, do not install software, add credentials, or expand the task just to enable it.

### One-primary-push discipline

Development churn should stay local or on the isolated worker branch until the Builder and Verifier agree the change is ready for CI.

- Prefer one consolidated primary implementation push after targeted validation and the Red Team gate.
- Batch closely related repairs instead of pushing each small edit separately.
- Do not request PR-hosted CodeRabbit/Codex review after every development commit; risk-routed PR review is a final-head gate. The bounded local CLI pass above is the only pre-push exception.
- More than roughly five meaningful implementation commits or more than two external-review repair cycles on one bounded task is a **process warning**, not a hard Git limit. Pause and re-check the graph/root-cause model before stacking more patches.

### External review policy

External AI review is an adversarial gate, not the primary developer.

- Treat every CodeRabbit/Codex finding as a hypothesis to verify against the current head and repository invariants before editing.
- Prefer the graph-owning Builder to apply verified fixes.
- Do not blindly run autofix on workflow, auth/RBAC, tenant-isolation, database/schema, payment, webhook, deployment, secret or other high-risk paths.
- For `.github/workflows/**`, use external review as review-only unless an explicitly authorized writer can safely apply the patch.
- The optional local CodeRabbit CLI pass described above is development feedback only; PR-hosted CodeRabbit/Codex review remains the authoritative external delivery gate.
- CodeRabbit remains the primary provider for risk-routed final PR review. Codex may act as an availability fallback only when CI classifies the PR as fallback-eligible medium risk and machine-observed evidence shows CodeRabbit is rate-limited, unavailable, skipped, or has exceeded the bounded response window.
- Codex fallback evidence must be bound to the current head through an exact-head request marker, an unchanged PR head, and a fresh Codex result recorded after that marker. Stale reactions or reviews from an older head never satisfy the gate.
- A current-head CodeRabbit `CHANGES_REQUESTED` decision is always blocking. Codex can never override it; only a later current-head CodeRabbit `APPROVED` decision may clear that state.
- Workflow, auth/RBAC, tenant/workspace, database/migration, payment, privacy/Directory, package/lockfile, environment/secret, and deployment-sensitive paths remain CodeRabbit-only under the automated fallback policy. CI must fail closed if CodeRabbit is unavailable for those paths.
- Re-enter final review only after the valid findings have been batched and locally validated.

### Baseline refresh without restart

When `main` advances during active work:

1. compare the new `main` changes with the reserved graph path and touch set;
2. if there is no material overlap, refresh the branch and rerun the affected gates without restarting the task analysis from zero;
3. if the source-of-truth node, dependency contract or invariant changed, stop implementation and update the graph before continuing.

### Autonomous continuation

Within an explicitly authorized phase, the Supervisor should not wait for a human “continue” message after every successful task.

After merge and any required exact-SHA Production verification:

1. release the completed graph lock;
2. resolve current `main` and open PRs again;
3. select the highest-priority unblocked task inside the authorized phase;
4. start the next independent task packet.

Stop and ask for human input when a real product decision is required, high-risk authorization is missing, Production mutation is not authorized, two architecture choices have materially different business consequences, or the current evidence cannot safely resolve the ambiguity.

---

## 2. Mandatory graph-engineering workflow

For every task, follow this loop in order.

### Phase A — Scope lock

State internally and preserve:

- requested outcome;
- exact repository and target branch;
- allowed files or graph nodes;
- forbidden areas;
- acceptance criteria;
- deployment and merge authority.

Do not expand scope without explicit evidence that another node is required.

### Phase B — Build the dependency graph

Before editing, identify:

- **Entry node:** where the symptom or request begins;
- **Source-of-truth node:** where the responsible data or behavior is owned;
- **Execution path:** imports, calls, API routes, database operations, redirects, jobs, or events involved;
- **Downstream nodes:** pages, services, customers, tenants, or deployments that may be affected;
- **Invariants:** behavior that must not change;
- **Blast radius:** the maximum plausible impact of the proposed change.

Use repository inspection and actual runtime evidence. Do not guess file paths, schemas, environment variables, or ownership boundaries.

### Phase C — Find the root cause

Distinguish clearly between:

- symptom;
- immediate failure;
- root cause;
- contributing conditions;
- unrelated observations.

Do not patch the symptom when the root cause is identifiable and safely reachable.

### Phase D — Design the minimal patch

Select the smallest change set that:

- reaches the root cause;
- preserves all known invariants;
- minimizes changed nodes and edges;
- is easy to review and revert;
- does not introduce speculative abstractions.

Priority order:

1. no-code correction or existing setting;
2. tiny fix in an existing file;
3. add-only file when a genuinely new boundary is required;
4. broader change only when proven necessary and explicitly permitted.

### Phase E — Implement atomically

- Work on one `work/proffera-*` branch.
- Never edit `main` directly.
- Keep one coherent purpose per commit.
- Stage and commit only files belonging to the locked scope.
- Do not mix formatting, refactoring, generated output, or unrelated fixes with the task.
- Keep rollback straightforward.

### Phase F — Validate affected edges

Validate from nearest to farthest:

1. syntax and type correctness;
2. lint/build checks relevant to the touched nodes;
3. targeted unit or integration behavior;
4. affected API/data/auth edges;
5. user-visible flow;
6. regression checks for preserved invariants.

A passing build alone does not prove the feature works. A manual UI check alone does not prove the dependency graph is sound.

### Phase G — Compare expected versus observed

For each acceptance criterion, record:

- expected behavior;
- observed behavior;
- evidence;
- pass/fail status.

If validation fails, return to the graph and update the root-cause model. Do not stack random patches.

### Phase H — Publish carefully

- Complete the pre-push Red Team gate from section 1A before the first implementation push.
- Review the complete diff before push.
- Confirm no forbidden or unrelated files changed.
- Prefer one consolidated push and avoid repeated deploy-triggering commits.
- Create a focused PR with the graph path, root cause, patch, blast radius, and validation evidence.
- Use PR-hosted external AI review only as the final risk-routed gate on the current head; verify findings before applying them. The bounded local CodeRabbit CLI pass in section 1A is development feedback and does not satisfy this delivery gate.
- Merge or deploy only when authorized by the user or by an explicit standing instruction.

### Phase I — Final report

Report exactly:

- root cause;
- graph path inspected;
- files changed;
- behavior changed;
- validation performed and results;
- branch, commit, PR, merge, and deployment status;
- residual risks or remaining work.

Never report “done” while any requested acceptance criterion remains unverified.

---

## 3. Proffera safety constraints

These rules apply unless the user explicitly overrides them for the current task.

### Branch and concurrency

- Use only branches named `work/proffera-*`.
- Never make direct changes to `main`.
- Use at most one coding worker on the same graph path at a time.
- Do not create duplicate branches, competing fixes, or parallel implementations for the same issue.
- Parallel writable PRs are **allowed** when they are on independent graph paths and there is no material touch-set overlap, shared source-of-truth conflict, incompatible invariant, or explicit merge-order dependency. The mere existence of another writable PR is **not** a blocker and is not a reason to pause unrelated work.
- Before each new push or merge decision, re-check current `main` and active PRs. If another PR changes only unrelated nodes, continue and refresh/revalidate as needed. Pause only when a material overlap, source-of-truth conflict, invariant conflict, stale-base risk that affects the reserved path, or required merge-order dependency is actually proven.
- Read-only research/review may run in parallel across the same path, but it must not create a competing implementation.

### Forbidden artificial files and probes

Never create:

- `__noop__` files;
- probe files;
- access-test files;
- temporary test files committed to the repository;
- dummy routes, dummy components, or placeholder implementations used only to test write access;
- files or markers named `ibbo-approved` or equivalent approval bypasses.

If a write or tool action is blocked, stop that action and report the blocker. Do not retry through disguised files or workaround mutations.

### High-risk graph nodes

Do not change these areas unless the task explicitly requires and authorizes them:

- authentication or authorization;
- database schema, migrations, row-level security, or tenant isolation;
- API contracts;
- background jobs or workflows;
- payment or financial logic;
- package dependencies or lockfiles;
- environment variables or secrets;
- deployment configuration;
- global navigation or large shared layouts;
- large existing components with broad downstream reach.

When one of these nodes is required, document the expanded blast radius before implementation.

### Multi-tenant invariants

Always preserve:

- tenant and workspace isolation;
- role-based access boundaries;
- customer data ownership;
- tenant-specific branding and settings;
- allowed-domain restrictions;
- language behavior;
- production data safety.

Never test destructive or uncertain changes against a real customer workspace. Do not use `juliussalong` for tests unless the user explicitly authorizes it.

### Test and fixture realism

- Use canonical migrations and shared test harnesses/fixtures when they exist. Do not copy Production table DDL into an integration test when a canonical migration or reusable helper can create the relevant contract.
- When a bug lives in SQL selection, locking, uniqueness, migration or transaction behavior, include a real PostgreSQL-backed regression when practical; do not mock away the responsible database edge.
- Create only the minimal dependency schema that is genuinely outside the canonical migration path.
- Keep expensive Docker/PostgreSQL suites explicitly opt-in when the repository has an integration-test flag or convention; normal unit-test runs should not unexpectedly provision infrastructure.
- Reuse canonical seed/build helpers instead of creating task-specific copies of common Workspace, Directory, Claim or Marketplace fixtures.

### Deployment discipline

- Batch validated changes to minimize Vercel builds.
- Do not deploy repeatedly after every tiny edit.
- Prefer local or non-deploying validation before push when available.
- Never trigger production deployment merely to test whether code compiles.
- After deployment, verify the exact production route and behavior affected by the task.

---

## 4. Change classification

Classify every proposed modification before editing.

### Class 0 — Observation only

Examples: audit, reproduce, inspect logs, trace dependencies.

- No file changes.
- Preferred starting mode.

### Class 1 — Tiny reversible fix

Examples: one conditional, label, redirect, validation rule, style constraint, or isolated bug fix.

- Smallest possible diff.
- Targeted validation required.

### Class 2 — Add-only boundary

Examples: a new isolated page, helper, documentation file, or endpoint that does not alter existing behavior.

- Use only when a new boundary is genuinely needed.
- Confirm routing, ownership, and downstream impact.

### Class 3 — Cross-node change

Examples: page + API + database, auth flow, booking workflow, shared navigation, or configuration.

- Requires explicit graph map and blast-radius review.
- Requires stronger validation and explicit authorization.

### Class 4 — Architecture or production-risk change

Examples: migrations, tenant model changes, payment logic, auth replacement, infrastructure changes, or large refactors.

- Stop and obtain explicit user approval before implementation.
- Provide rollback and migration plans first.

---

## 5. Decision rules

Use these rules when choices compete:

- Choose proven behavior over elegant speculation.
- Choose fewer touched nodes over broader cleanup.
- Choose source-of-truth correction over duplicated state.
- Choose explicit data flow over hidden coupling.
- Choose reversible changes over irreversible migrations.
- Choose one validated implementation over multiple unfinished options.
- Choose delayed deployment over repeated unnecessary deploys.
- Choose transparent blocker reporting over risky workaround attempts.
- Choose local repair and one validated primary push over PR-by-PR development churn.

---

## 6. Required worker output format

Every substantial worker response must contain:

### Graph diagnosis

- Entry node:
- Root-cause node:
- Dependency path:
- Affected downstream nodes:
- Preserved invariants:
- Estimated blast radius:

### Execution

- Change class:
- Branch:
- Files changed:
- Minimal patch summary:

### Validation

- Checks run:
- Expected result:
- Observed result:
- Acceptance criteria status:
- Pre-push Red Team: passed | findings fixed | not applicable (reason)

### Delivery status

- Commit:
- Pull request:
- Merge status:
- Deployment status:
- Remaining risks or work:

Use `not performed`, `not authorized`, or `not verified` when applicable. Never invent status.

---

## 7. Definition of done

A task is done only when all of the following are true:

- the real problem or requirement was verified;
- the dependency graph was traced far enough to identify the responsible node;
- the smallest safe patch was applied;
- unrelated nodes were not changed;
- relevant checks passed;
- the pre-push Red Team review was completed for implementation work and valid findings were resolved;
- the user-visible acceptance criteria were verified;
- tenant, auth, data, and deployment invariants were preserved;
- blocking current-head review findings are resolved or explicitly accepted by an authorized human;
- branch, commit, PR, merge, and deployment states were reported accurately;
- any remaining risk is explicit.

If any item is missing, the task is not done.
