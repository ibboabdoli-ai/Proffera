# Proffera documentation map

This file defines which project records are authoritative for AI workers and humans.

## Canonical sources

Read these in this order before changing Proffera:

1. `AGENTS.md` — mandatory worker protocol and engineering safety rules.
2. `WORKER_BOOTSTRAP.md` — mandatory startup/baseline/handoff contract for AI/product workers.
3. GitHub issue #548 — live AI supervisor/control board and current work queue.
4. GitHub issue #276 — product/engineering execution roadmap and dependency order.
5. `docs/CURRENT_STATUS.md` — current stable factual source/deployment/testing status.
6. `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json` — stable machine-readable evidence contract for declaring Proffera V1 complete; it defines required proof and never serves as a live completion report.

GitHub/Copilot coding agents also receive `.github/copilot-instructions.md`, which points them to the same canonical startup order.

## Historical documents

Other phase plans, handoffs, old status files, and completed plans under `docs/` are historical context unless one of the canonical sources explicitly points to them.

Do not treat an older phase/status document as current project truth when it conflicts with the canonical sources above. Git history preserves prior versions of the canonical files.

## V1 evidence rule

`docs/V1_LAUNCH_EVIDENCE_CONTRACT.json` defines what kinds of evidence are required for each launch criterion. It does not mark criteria complete and must not be used to turn source merges, green builds, historical screenshots, or unchecked issue text into Production proof.

Current `main`, executable tests, exact-head CI/review evidence, isolated Preview/Staging runtime evidence, fresh read-only Production evidence, exact deployed-SHA Production runtime evidence, and explicit human approval for restricted real-world actions remain the authoritative proof sources described by the contract.

## Worker bootstrap and handoff rule

Every non-Dependabot pull request must carry the machine-readable Worker Bootstrap fields defined in `WORKER_BOOTSTRAP.md` and `.github/pull_request_template.md`.

Required CI verifies:

- the `work/proffera-*` branch convention;
- a concrete task/issue identity;
- `Worker bootstrap: complete`;
- `Supervisor handoff: #548`;
- a 40-character bootstrap baseline matching the current PR base SHA;
- exactly one documentation-impact declaration.

A dedicated GitHub Actions workflow automatically writes `work/proffera-*` PR opened/reopened/ready-for-review/closed/merged lifecycle events to issue #548. This provides a durable automatic event trail even when an individual worker forgets to update the board manually.

## Documentation update rule

Every non-Dependabot pull request must state exactly one of these lines in its PR body:

- `Documentation impact: updated`
- `Documentation impact: none`

Use `updated` when the PR changes a project-level fact that a future worker needs to know, such as architecture, security boundaries, deployment/runtime behavior, major feature availability, canonical workflows, or release gates. In that case `docs/CURRENT_STATUS.md` must be changed in the same PR.

Use `none` only when the change does not alter project-level truth.

Dependency-bot pull requests are exempt from Worker Bootstrap and documentation declarations.
