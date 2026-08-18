# Proffera documentation map

This file defines which project records are authoritative for AI workers and humans.

## Canonical sources

Read these in this order before changing Proffera:

1. `AGENTS.md` — mandatory worker protocol and engineering safety rules.
2. GitHub issue #548 — live AI supervisor/control board and current work queue.
3. GitHub issue #276 — product/engineering execution roadmap and dependency order.
4. `docs/CURRENT_STATUS.md` — current factual source/deployment/testing status.

## Historical documents

Other phase plans, handoffs, old status files, and completed plans under `docs/` are historical context unless one of the canonical sources explicitly points to them.

Do not treat an older phase/status document as current project truth when it conflicts with the canonical sources above. Git history preserves prior versions of the canonical files.

## Documentation update rule

Every pull request must state one of these lines in its PR body:

- `Documentation impact: updated`
- `Documentation impact: none`

Use `updated` when the PR changes a project-level fact that a future worker needs to know, such as architecture, security boundaries, deployment/runtime behavior, major feature availability, canonical workflows, or release gates. In that case `docs/CURRENT_STATUS.md` must be changed in the same PR.

Use `none` only when the change does not alter project-level truth.

Dependency-bot pull requests are exempt from this declaration.
