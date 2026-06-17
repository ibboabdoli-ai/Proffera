# P23B — Better Auth route handler draft report

Status: completed  
Date: 2026-06-17  
Type: runtime route draft  
Database changes: none  
Deployment: none  

## Purpose

This document records the P23B draft route handler for Better Auth.

## Scope

P23B adds only the minimal Better Auth API route handler.

## Added route

The following route handler was added:

`src/app/api/auth/[...all]/route.ts`

The route uses:

- `toNextJsHandler` from `better-auth/next-js`
- `getAuth()` from `src/lib/auth.ts`
- `runtime = "nodejs"`

## Lazy initialization

The route intentionally calls `getAuth()` inside a handler factory instead of creating the auth instance at module import time.

Reason:

- `getAuth()` requires `DATABASE_URL`.
- Lazy initialization reduces the chance of build-time environment failures.
- The route initializes auth only when the auth route receives a request.

## Non-goals

P23B does not:

- Add login UI.
- Add signup UI.
- Create users.
- Create sessions manually.
- Remove temporary Basic Auth.
- Change dashboard access control.
- Change middleware behavior.
- Modify database schema.
- Run migrations.
- Deploy.

## Expected behavior

The route handler should expose the Better Auth API surface under:

`/api/auth/[...all]`

The route is not yet connected to the public login page.

## Safety notes

Do not remove Basic Auth until:

1. Better Auth route behavior is verified.
2. Login UI is wired and tested.
3. Session lookup is implemented.
4. Workspace membership checks are implemented.
5. Dashboard access control has a rollback path.

## Validation

P23B must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Conclusion

P23B adds the minimal Better Auth route handler draft without changing user-facing login behavior or dashboard protection.
