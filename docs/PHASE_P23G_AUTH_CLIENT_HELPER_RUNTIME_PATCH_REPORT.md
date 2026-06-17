# P23G — Auth client helper runtime patch report

Status: completed
Date: 2026-06-17
Type: minimal runtime helper
Database changes: none
Deployment: none

## Purpose

This document records the P23G Better Auth client helper runtime patch.

## Scope

P23G adds a minimal client helper file for future login UI wiring.

## Changed files

- `src/lib/auth-client.ts`
- `docs/PHASE_P23G_AUTH_CLIENT_HELPER_RUNTIME_PATCH_REPORT.md`

## Runtime change

Added:

`src/lib/auth-client.ts`

The helper exports a named Better Auth client:

`authClient`

The helper uses Better Auth's React client entrypoint:

`better-auth/react`

The helper does not set `baseURL`, so it keeps same-origin behavior for the current app and auth route.

## Helper content

The helper contains:

`import { createAuthClient } from "better-auth/react";`

`export const authClient = createAuthClient();`

## Safety behavior

This patch does not wire login submission.

The helper:

- Does not modify `/logga-in`.
- Does not submit credentials.
- Does not call `authClient.signIn.email`.
- Does not create a user.
- Does not create a session by itself.
- Does not read a session.
- Does not read workspace memberships.
- Does not remove Basic Auth.
- Does not change dashboard access.
- Does not change middleware.
- Does not change database schema.
- Does not deploy.

## Non-goals

P23G does not:

- Enable the login form.
- Add submit handling.
- Add loading state.
- Add error state.
- Add redirect behavior.
- Add session enforcement.
- Add workspace membership checks.
- Remove Basic Auth.

## Validation

P23G passed:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Next phase

The next safe phase is P23H.

P23H should wire `/logga-in` to the helper with minimal login submit behavior, while still keeping Basic Auth and dashboard access unchanged.

## Conclusion

P23G adds only the Better Auth client helper required for future login submission.

No authentication behavior is enabled in this phase.
