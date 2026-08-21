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

## Mandatory project toolchain check

Use the tooling already present in Proffera before proposing replacements, broad manual inspection, or new third-party tools. Not every tool is required for every task; use the relevant tool for the graph path and report `not performed` when it is not applicable or unavailable.

### Graphify — architecture and dependency analysis

- For cross-node, architecture, dependency, caller/callee, or blast-radius work, read `.codex/skills/graphify/SKILL.md` before broad raw-code searching.
- Use the pinned Graphify release required by that skill (`0.9.42`). Do not trust an arbitrary `graphify` executable with another version.
- If `graphify-out/graph.json` exists and is current enough for the task, query the existing graph first. Rebuild only when it is missing/stale or the task requires it.
- Graphify is code intelligence, not a source of truth for live state. Confirm Production/runtime/database/auth/billing/company facts in their authoritative systems.
- Never send secrets, `.env*`, credentials, tokens, or Production/customer data into Graphify. Never commit generated `graphify-out/` or `graph.json` output.

### Local validation stack — nearest checks first

The root repository already provides the standard validation commands:

- `npm run lint` — ESLint;
- `npm run typecheck` — TypeScript;
- `npm test` — Vitest;
- `npm run build` — Next.js production build.

Run the narrowest relevant checks first, then broaden validation according to `AGENTS.md` and the touched graph nodes. Do not treat a green build as proof of runtime behavior.

### Playwright — browser/user-flow proof

- Playwright is already installed under `e2e/` and is part of the public browser CI path.
- Use it for relevant public/customer-facing behavior, bilingual flows, mobile/browser regressions, and approved Preview E2E paths.
- Keep destructive or state-changing browser tests off Production and real customer Workspaces. Use the isolated Preview boundary when mutation is required.
- Do not add a second browser-testing framework for the same purpose without a verified gap and explicit approval.

### GitHub Actions, CodeQL, and required CI

- GitHub Actions is the delivery gate. Required repository checks include `Validate` and `E2E public smoke` as defined by the current workflows.
- `Validate` covers governance plus the repository validation stack and repository-specific checks; workers must not bypass or replace it with a local-only claim.
- CodeQL is configured for JavaScript/TypeScript security analysis and runs when the repository `CODEQL_ENABLED` control enables it. Treat findings as security evidence to triage, not as a replacement for tests.
- Workflow/action changes are security-sensitive; preserve least privilege and immutable action SHA pinning.

### CodeRabbit — final risk-routed review only

- CodeRabbit is configured, but automatic/incremental review is intentionally disabled.
- Let CI route only sensitive/large PRs to the exact-head final review path. Do not request a new CodeRabbit review after every small commit.
- When CodeRabbit requests changes, return to a controlled fix cycle, batch the fixes, validate them, and request/re-enter final review only for the final head.
- Never bypass a blocking current-head review decision or treat an old review as evidence for a new commit.

### Dependabot — dependency maintenance

- Dependabot is already configured for the root npm project, `e2e/`, and GitHub Actions on a weekly schedule.
- Prefer the existing Dependabot path for routine dependency updates. Do not introduce Renovate, mass dependency sweeps, or unrelated package upgrades unless a verified need is explicitly in scope.

### Preview/runtime proof

- For state-changing Auth, Booking, Quote, Marketplace, email, billing, migration, or tenant-isolation proof, use Vercel Preview only after verifying the non-Production boundary relevant to the task.
- When database mutation is required, use an explicitly isolated non-Production database/Neon branch and verify it cannot resolve to Production/shared state.
- External egress such as email or payments must use controlled Preview recipients/test mode and fail closed when isolation is uncertain.

### Planned tools are not installed tools

`docs/PROFFERA_WORKFLOW.md` may list future tools such as Sentry, Checkly, or PostHog. Do not assume they are installed or available until repository/runtime evidence proves it. Semgrep and Renovate remain deferred unless the current canonical workflow explicitly changes.

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
