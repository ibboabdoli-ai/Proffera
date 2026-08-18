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

Never add or remove `ibbo-approved`. That label is human merge authorization only.

## Automatic Supervisor event log

GitHub Actions records `work/proffera-*` PR lifecycle events into issue #548 when a PR is opened/reopened, marked ready for review, or closed/merged.

This automatic event log does not replace the worker's responsibility to provide accurate PR scope, validation evidence, blockers, and remaining work.

## Done means verified

A worker may report Done only after the relevant Definition of Done in `AGENTS.md` is satisfied. If a required check, Preview verification, merge, deployment, or acceptance criterion was not performed, say so explicitly.
