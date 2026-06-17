# P23N - Workspace access helper foundation report

Status: completed
Date: 2026-06-17
Type: minimal runtime helper
Database changes: none
Deployment: none

## Purpose

P23N adds the first read-only workspace access helper foundation.

The helper checks workspace access after a Better Auth server session exists.

## Changed files

- `src/lib/workspace-access.ts`
- `docs/PHASE_P23N_WORKSPACE_ACCESS_HELPER_FOUNDATION_REPORT.md`

## Runtime change

P23N adds `getUserWorkspaceAccess()`.

The helper:

1. Reads the Better Auth server session through `getServerSession()`.
2. Extracts the session user id.
3. Confirms the user exists in the Better Auth `user` table.
4. Reads the first allowed workspace membership.
5. Accepts only workspaces with status `active` or `trial`.
6. Accepts only known workspace roles: `owner`, `admin`, `staff`, `viewer`.
7. Returns a normalized success or failure result.

## Safety behavior

P23N does not modify dashboard routes.

P23N does not modify `/logga-in`.

P23N does not modify middleware.

P23N does not remove Basic Auth.

P23N does not add redirects.

P23N does not mutate users, sessions, memberships, workspaces, plans, feature flags, CRM data, bookings, customers, or settings.

P23N does not change database schema.

P23N does not deploy.

## Important limitation

The helper is created but not connected to the dashboard yet.

Dashboard enforcement must happen in a later phase after this helper has been verified.

## Failure behavior

The helper fails closed.

If database configuration is missing, if the user is missing, if membership is missing, or if workspace state is invalid, the helper returns `ok: false`.

## Validation

P23N must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Conclusion

P23N adds a read-only workspace access helper foundation.

No dashboard, middleware, Basic Auth, database schema, or deployment behavior is changed in this phase.

## Validation notes

Local validation passed after a real `DATABASE_URL` was exported into the shell for this build session.

The repository does not commit database secrets.

The pulled Vercel environment files still showed empty placeholder database values during this phase.

Vercel production environment variables must be fixed in a separate configuration phase before deployment.

Better Auth also printed local build warnings for missing `BETTER_AUTH_URL` or `baseURL`, and for default or missing `BETTER_AUTH_SECRET`.

These were not fixed in code in P23N because environment secrets and deployment URLs must be configured outside the repository.
