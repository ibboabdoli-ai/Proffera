# Proffera Worker Bootstrap

This is the mandatory startup and handoff contract for every AI/product worker operating on Proffera.

## Before changing code

Read these sources in order:

1. `AGENTS.md` — engineering and safety protocol.
2. GitHub issue #548 — live Supervisor board, current `main` baseline, active work and blockers.
3. GitHub issue #276 — roadmap and dependency order.
4. `docs/CURRENT_STATUS.md` — stable factual project status.
5. `docs/README.md` — documentation authority map.

Then capture the current `main` SHA and use it as the task baseline.

Do not start implementation when:

- another worker is already changing the same graph path;
- the requested task conflicts with #548 or #276 and the conflict is unresolved;
- the repository baseline changed materially during analysis and the graph was not refreshed;
- required secrets, Production access, or high-risk authorization are missing.

The existence of another writable PR is not itself a blocker. Parallel writable PRs may continue when their graph paths are independent and there is no material touch-set overlap, shared source-of-truth conflict, incompatible invariant, or explicit merge-order dependency. If `main` advances because an unrelated PR merges, refresh/revalidate the affected branch as needed instead of stopping or restarting unrelated work from zero.

## Existing engineering toolchain

Use the tooling already present in Proffera before adding overlapping tools or broad manual substitutes. Select only what the current graph path needs and report `not performed` when a tool is not applicable or unavailable.

- **Graphify 0.9.42** — for cross-node architecture, dependency, caller/callee, and blast-radius work. Read `.codex/skills/graphify/SKILL.md`, prefer a sufficiently current existing graph, and keep live repository/runtime/database evidence authoritative. Never include secrets, customer data, or generated graph output in commits.
- **ESLint / TypeScript / Vitest / Next build** — run the narrowest relevant checks first and broaden according to `AGENTS.md`; a green build alone is not runtime proof.
- **Playwright** — use the existing `e2e/` browser stack for relevant public/customer flows and approved isolated Preview proof. Never run destructive/state-changing browser flows against Production or real customer Workspaces.
- **GitHub Actions / CodeQL** — required CI remains the delivery gate. Workflow/action changes are security-sensitive; preserve least privilege and immutable action SHA pinning. Risk routing is defined once by `scripts/ci/classify-pr-risk.mjs`; do not duplicate or locally reinterpret its path policy in workflows.
- **Active CI supervision** — while a Supervisor or Builder is actively executing a PR, do not rely on hourly or other periodic automation to discover whether current-head CI finished or failed. After each implementation push, check the current-head required GitHub Actions after the expected run window and continue with bounded short-interval checks while actively working. If a required check fails, inspect the exact failed job/log promptly, verify the root cause, repair only the same locked graph path, and rerun the affected gates. Scheduled automation is a backup for inactive periods, not a substitute for active supervision. Never use tight, unbounded, or wasteful polling loops.
- **SonarQube** — `.github/workflows/sonarqube.yml` is an optional additional code-quality/maintainability signal. It stays dormant unless `SONARQUBE_ENABLED=true`, `SONAR_PROJECT_KEY`, exactly one of `SONAR_HOST_URL` or `SONAR_ORGANIZATION`, and secret `SONAR_TOKEN` are configured. The initial quality gate is advisory (`sonar.qualitygate.wait=false`) and does not replace CodeQL, tests, review, or runtime proof. Prioritize findings in new/touched/reachable code rather than expanding scope into unrelated historical debt.
- **External AI review** — the final risk-routed gate is provider-neutral and exact-head. Codex is the primary reviewer; CodeRabbit is the bounded availability fallback and may also contribute optional current-head evidence. A finding from either provider remains blocking for that head and cannot be erased by a clean result from the other provider. A new commit invalidates old review evidence. PR-Agent/Gemini is not an authoritative pass path until a repository-approved credential boundary and machine-verifiable clean/finding contract are proven on a real non-sensitive PR. For Class 3/4 work, or work that would match AI review routing, one local pre-push CodeRabbit CLI pass may still be used **after targeted validation and the internal Red Team, but before the first implementation push**, when the CLI is already installed and authenticated. Use `cr review --agent --base main`, verify findings, rerun affected checks, and allow at most two CLI passes. If the CLI is unavailable, report it and continue to the required provider-neutral current-head PR gate.
- **Dependabot** — use the existing dependency-maintenance path for routine package/action updates instead of introducing a second updater without a proven gap.
- **Preview/runtime proof** — state-changing Auth, Booking, Quote, Marketplace, email, billing, migration, or tenant-isolation verification belongs in an explicitly isolated non-Production boundary with controlled external egress.

SonarQube credentials must never be committed or logged. The repository-side integration is intentionally fail-closed when explicitly enabled with incomplete or ambiguous Server/Cloud configuration.

## Branch and task identity

- Use one branch named `work/proffera-*`.
- Never edit `main` directly.
- Keep one graph path / purpose per branch.
- Identify the task using a GitHub issue number when one exists; otherwise use `user-request`.

## Pull request handoff

Every non-Dependabot PR must include these exact machine-readable lines:

```text
Task/issue: <issue-number-or-user-request>
Bootstrap baseline: <40-character-main-sha>
Worker bootstrap: complete
Supervisor handoff: #548
Documentation impact: updated
```

or, when stable project truth did not change:

```text
Documentation impact: none
```

The bootstrap baseline must match the PR base SHA used for the validated work. If `main` advances and the branch is refreshed, update the line before rerunning CI.

Never add or remove `ibbo-approved`. That label remains per-PR human merge authorization only; when used as the automerge fallback, it must also be backed by a repository-owner `APPROVED` review anchored to the exact current PR head commit.

## Standing merge authorization

A separate repository-owner authorization may be committed on `main` in `.github/proffera-standing-merge-authorization.json` for a narrowly defined phase. This is a durable authorization source for gated automerge and is not worker self-approval.

Rules:

- the automerge workflow reads the standing policy only from `main`, never from the PR branch;
- ordinary workers must not create, edit, expand or extend the standing policy;
- the policy must be scoped by owner, phase, Supervisor issue, explicit branch prefixes and expiry;
- standing authorization applies only to same-repository PRs authored from a branch owned by the repository owner; matching fork PRs or PRs authored by another account are rejected;
- the standing policy, workflow files, canonical risk classifier, canonical review evaluator, and other control-plane paths are outside standing automerge and require the normal controlled merge path;
- current-head `Validate`, required browser/review gates, provider-neutral risk-routed AI review decisions and head-SHA matching remain mandatory;
- when the canonical classifier returns `humanMergeRequired=true`, standing authorization is insufficient and fresh exact-head owner authorization is required;
- blocked infrastructure, secret, auth, deployment, database/schema and package paths remain outside standing automerge even when the phase is authorized.

## Automatic Supervisor event log

GitHub Actions records `work/proffera-*` PR lifecycle events into issue #548 when PRs are opened/reopened, marked ready for review, or closed/merged.

This automatic event log does not replace the worker's responsibility to provide accurate PR scope, validation evidence, blockers, and remaining work.

## Done means verified

A worker may report Done only after the relevant Definition of Done in `AGENTS.md` is satisfied. If a required check, Preview verification, merge, deployment, or acceptance criterion was not performed, say so explicitly.
