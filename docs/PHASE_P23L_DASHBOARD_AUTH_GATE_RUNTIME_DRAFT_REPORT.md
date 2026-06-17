# P23L - Dashboard auth gate runtime draft report

Status: completed
Date: 2026-06-17
Type: minimal runtime draft
Database changes: none
Deployment: none

## Purpose

P23L adds the first minimal Better Auth session gate to dashboard routes.

## Changed files

- `src/app/dashboard/layout.tsx`
- `docs/PHASE_P23L_DASHBOARD_AUTH_GATE_RUNTIME_DRAFT_REPORT.md`

## Runtime change

The dashboard layout now reads the Better Auth server session with `getServerSession()`.

If no session exists, the layout redirects to `/logga-in`.

If a session exists, the dashboard renders through the existing `DashboardShell`.

## Safety behavior

P23L does not remove Basic Auth.

P23L does not modify middleware.

P23L does not modify `/logga-in`.

P23L does not add workspace authorization yet.

P23L does not change database schema.

P23L does not deploy.

## Important limitation

This is a session gate only.

A Better Auth session proves authentication, but not workspace authorization.

Future phases must add workspace membership and workspace access checks before this is considered complete dashboard authorization.

## Validation

P23L must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Next phase

The next safe phase is P23M - Workspace access helper plan.

## Conclusion

P23L adds a minimal server-side dashboard session gate.

No Basic Auth, middleware, database, or deployment behavior is changed in this phase.

## Validation notes

Local build passed, but Better Auth printed environment warnings during build:

- `BETTER_AUTH_URL` or explicit `baseURL` is not configured in the local build environment.
- `BETTER_AUTH_SECRET` is not configured in the local build environment or the default secret is being used.

These warnings were not fixed in code in P23L because secrets and environment URLs must not be committed to the repository.

Production environment configuration must be verified in a separate configuration phase before deployment.

The build also changed dashboard routes from static to dynamic because the dashboard layout now reads request-bound session state.
