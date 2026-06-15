# Project Log

This file records what has been built and tested in Proffera.

## P22C — Auth implementation decision

Status: done.

Details: `docs/PHASE_P22C_AUTH_IMPLEMENTATION_DECISION.md`

Built:

- Selected Better Auth with PostgreSQL/Neon as the planned authentication foundation.
- Confirmed Proffera should keep ownership of workspace, membership, role and business authorization tables.
- Compared Better Auth, Clerk, Supabase Auth and custom auth.
- No code, dependency or database migration was added in this decision step.

Tested:

- Official auth documentation was checked.
- Current `package.json` and existing Proffera stack were checked.

## P22B — Auth and workspace model plan

Status: done.

Details: `docs/PHASE_P22B_AUTH_WORKSPACE_MODEL_PLAN.md`

Built:

- Added a plan for real Proffera users, sessions, workspaces, workspace memberships and roles.
- Documented the rule that dashboard workspace access must come from trusted session membership, not from query params or hidden fields.
- Documented a safe additive migration path for future auth/workspace tables.
- No code, dependency or database migration was added in this planning step.

Tested:

- Confirmed `package.json` has no auth dependency.
- Confirmed middleware currently uses temporary dashboard protection.
- Confirmed the master plan requires session-derived workspace identity before real onboarding.

## P22A — Dashboard temporary Basic Auth

Status: done.

Details: `docs/logs/PHASE_P22A_DASHBOARD_TEMP_BASIC_AUTH.md`

Built:

- `/dashboard` and `/dashboard/*` now have temporary Basic Auth protection.
- Dashboard still returns `X-Robots-Tag: noindex, nofollow` after access is accepted.
- Admin protection, public pages, CRM/booking data access and Service AI Chat redirects were kept separate.
- No real customer authentication, session handling, roles or workspace binding was added.

Tested:

- Code inspection completed for middleware behavior.
- Local typecheck/lint/build were not run in this environment.
- Vercel status was checked and returned success.

## P21 — Proffera login entry foundation

Status: done.

Details: `docs/logs/PHASE_P21_PROFFERA_LOGIN_ENTRY.md`

Built:

- Public `Logga in` now links to `/logga-in` inside Proffera.
- `/logga-in` no longer redirects to `chat.proffera.se`.
- `/logga-in` is a Proffera customer portal entry placeholder.
- No real authentication, session handling, billing, roles or workspace binding was added.

Tested:

- Code inspection completed for the changed files.
- Local typecheck/lint/build were not run in this environment.

## Phase 18.17B — Documentation workflow cleanup

Status: pending PR review.

Details: `docs/logs/PHASE_18_17B_DOCUMENTATION_WORKFLOW_CLEANUP.md`

## 2026-06-14 — Documentation aligned with current SaaS direction

Status: documentation-only update.

Updated:

- Reframed Proffera as the parent SaaS product for Swedish service businesses.
- Documented Service AI Chat as a separate related engine under `chat.proffera.se`.
- Added the P-01 to P-05 widget/inbox integration strategy.
- Recorded the strict tenant-isolation rule: Iboren and Proffera data must never mix.
- Updated current phase status through verified Phase 18.14 and planned Phase 18.15.
- Recorded website/security audit notes, protected flows, rollback expectations, and documentation consistency fixes.

No application code, package files, database files, routes, components, or deployment state changed in this documentation update.

## Phase 07 — Company registration

Status: done.

Built:

- Company registration form.
- Company thank-you page.
- Admin company list.
