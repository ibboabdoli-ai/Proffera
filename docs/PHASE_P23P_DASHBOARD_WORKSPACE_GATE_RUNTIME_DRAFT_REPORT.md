# P23P - Dashboard workspace gate runtime draft report

Status: completed
Date: 2026-06-17
Type: minimal runtime draft
Database changes: none
Deployment: none

## Purpose

P23P connects the dashboard layout to the workspace access helper foundation.

## Changed files

- `src/app/dashboard/layout.tsx`
- `docs/PHASE_P23P_DASHBOARD_WORKSPACE_GATE_RUNTIME_DRAFT_REPORT.md`

## Runtime change

The dashboard layout now calls `getUserWorkspaceAccess()` instead of only reading the Better Auth session.

If the helper returns `no_session`, the user is redirected to `/logga-in`.

If the helper returns another failure, the dashboard renders a generic Swedish access-denied message inside the existing `DashboardShell`.

If workspace access is valid, the dashboard renders as before.

## Safety behavior

P23P does not modify `/logga-in`.

P23P does not modify middleware.

P23P does not remove Basic Auth.

P23P does not change database schema.

P23P does not deploy.

P23P does not mutate users, memberships, workspaces, plans, feature flags, CRM data, bookings, customers, or settings.

## Access-denied behavior

The access-denied copy is generic.

It does not reveal whether the user, workspace, membership, role, plan, or feature flag exists.

## Validation

P23P must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Environment note

Local build may require a real `DATABASE_URL` exported into the shell because the pulled Vercel env files previously contained empty placeholder database values.

Secrets must not be committed to the repository.

## Conclusion

P23P adds a minimal dashboard workspace gate runtime draft.

No middleware, Basic Auth, database schema, or deployment behavior is changed in this phase.
