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
   - Complete analysis, implementation, validation, and reporting for the current graph path before starting another path.
   - Do not jump phases or open multiple competing implementations.

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

- Review the complete diff before push.
- Confirm no forbidden or unrelated files changed.
- Prefer one consolidated push and avoid repeated deploy-triggering commits.
- Create a focused PR with the graph path, root cause, patch, blast radius, and validation evidence.
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
- the user-visible acceptance criteria were verified;
- tenant, auth, data, and deployment invariants were preserved;
- branch, commit, PR, merge, and deployment states were reported accurately;
- any remaining risk is explicit.

If any item is missing, the task is not done.