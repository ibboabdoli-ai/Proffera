# P23F — Better Auth client helper plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

This document defines the safe plan for introducing a Better Auth client helper before wiring real login submission into `/logga-in`.

P23F does not add runtime code, does not submit credentials, does not create sessions, does not remove Basic Auth, and does not change dashboard protection.

## Current state

The server route exists at:

`/api/auth/[...all]`

The `/logga-in` page now has a static disabled visual form.

The form does not call Better Auth yet.

The dashboard remains protected by temporary Basic Auth.

## Better Auth client direction

The future client helper should be added in a dedicated client-side file.

Recommended future file:

`src/lib/auth-client.ts`

Recommended future direction:

- Use `createAuthClient`.
- Prefer the React client entrypoint for React UI usage.
- Do not set `baseURL` unless required.
- Keep default same-origin behavior if the app and auth route run on the same domain.
- Export a named client or selected methods in a small, explicit wrapper.

Recommended future shape:

`import { createAuthClient } from "better-auth/react";`

`export const authClient = createAuthClient();`

The final runtime implementation must be verified by TypeScript before being used by `/logga-in`.

## Future sign-in flow

The future login submit flow should use the Better Auth email sign-in method.

Expected inputs:

- email
- password
- optional callback URL
- optional remember-me behavior

Recommended first redirect target:

`/dashboard`

Do not use workspace-aware redirects until workspace membership checks are implemented.

## Client-only rule

The future login submit code must be a client component or use a client-side submit handler.

The login submit logic must not run in a server component.

## Error handling plan

The login UI should use one generic Swedish error message:

`Det gick inte att logga in. Kontrollera uppgifterna och försök igen.`

Do not reveal whether:

- the email exists,
- the password is wrong,
- the account exists but is disabled,
- the user has no workspace membership.

## Loading behavior plan

During submit, the UI should:

- Disable the email input.
- Disable the password input.
- Disable the submit button.
- Show `Loggar in...`.
- Prevent duplicate submit.
- Clear previous error before a new attempt.

## Security requirements

The future runtime implementation must follow these rules:

- Do not log passwords.
- Do not log auth response tokens.
- Do not log full auth responses.
- Do not expose `DATABASE_URL`.
- Do not expose Better Auth secrets.
- Do not reveal whether an email exists.
- Do not remove Basic Auth in the same patch.
- Do not change dashboard access in the same patch.
- Do not create users from the login page.
- Do not add sign-up from the login page in this phase.

## Future implementation phases

### P23G — Auth client helper runtime patch

Add the auth client helper only.

Expected scope:

- Add `src/lib/auth-client.ts`.
- No login submit.
- No session reading.
- No dashboard access change.
- No Basic Auth removal.

### P23H — Login submit minimal patch

Wire `/logga-in` to the auth client.

Expected scope:

- Convert only the login form to a client-side submit form.
- Call the Better Auth email sign-in method.
- Show loading state.
- Show generic error state.
- Redirect on success.
- No dashboard access change.
- No Basic Auth removal.

### P23I — Session read helper plan

Plan how the server should read sessions.

Expected scope:

- Server-side session reading plan.
- No enforcement change.

### P23J — Workspace membership plan

Plan how authenticated users map to workspace access.

Expected scope:

- Workspace membership lookup.
- Role rules.
- Redirect behavior.
- No dashboard enforcement yet.

## Non-goals for P23F

P23F does not:

- Add `src/lib/auth-client.ts`.
- Modify `/logga-in`.
- Enable form submission.
- Call `/api/auth`.
- Create users.
- Create sessions.
- Read sessions.
- Read workspace memberships.
- Remove Basic Auth.
- Change middleware.
- Change dashboard protection.
- Change database schema.
- Deploy.

## Validation requirements for future runtime helper

Before a runtime auth client helper patch is merged, it must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

The helper should be verified by TypeScript before being used by `/logga-in`.

## Conclusion

P23F is a planning-only phase.

The next safe runtime phase is P23G, which should add only a Better Auth client helper file without wiring real login submission yet.
