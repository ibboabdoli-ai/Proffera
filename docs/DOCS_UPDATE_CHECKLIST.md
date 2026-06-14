# Documentation Update Checklist

Use this checklist after every completed, verified, paused, or materially changed phase.

## Required updates

1. Update `docs/CURRENT_STATUS.md`.
   - Record the completed/current phase.
   - Record production status.
   - Set the recommended next safe step.
   - Add or remove open risks.

2. Add a concise phase log under `docs/logs/`.
   - State scope, outcome, verification, risks, rollback, and next step.
   - Do not rewrite the long historical `docs/PROJECT_LOG.md`.

3. Update `docs/ROADMAP.md` only when priorities or sequence change.

4. Update `docs/PROJECT_HANDOFF.md` only when operational safeguards, protected flows, or handoff rules change.

5. Update `docs/DECISIONS.md` only for stable architecture or workflow decisions.

6. Update `README.md` only when product direction, stack, major architecture, or documentation entry points change.

7. Add a short index entry to `docs/PROJECT_LOG.md` only when useful.

## Verification

- Confirm `docs/CURRENT_STATUS.md` is the only detailed current-status source.
- Confirm phase claims match accepted verification or the approved task brief.
- Confirm links point to real files.
- Confirm changed files are documentation-only.
- Run `git diff --check`.
- Review `git diff --name-only`.
- Do not commit directly to `main`.
- Open a PR and do not merge it without approval.

## Command conventions

- `u` = review/update docs only.
- `t` = simple status summary.
- `b` / `B` = continue or approve the next safe step.

These commands do not override explicit safety rules, approval gates, or scope limits.
