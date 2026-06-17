# P23H — Login submit minimal patch report

Status: completed
Date: 2026-06-17
Type: minimal login submit runtime patch
Database changes: none
Deployment: none

## Purpose

This document records the P23H minimal login submit patch.

## Scope

P23H wires the `/logga-in` form to the Better Auth client helper added in P23G.

## Changed files

- `src/app/logga-in/LoginForm.tsx`
- `src/app/logga-in/page.tsx`
- `docs/PHASE_P23H_LOGIN_SUBMIT_MINIMAL_PATCH_REPORT.md`

## Runtime change

P23H adds a client component for the login form.

The form now:

- Accepts email.
- Accepts password.
- Calls `authClient.signIn.email`.
- Shows a loading state.
- Shows a generic Swedish error message.
- Redirects to `/dashboard` after successful login.

## Security behavior

The form uses one generic error message:

`Det gick inte att logga in. Kontrollera uppgifterna och försök igen.`

The form does not reveal whether:

- the email exists,
- the password is wrong,
- the account exists but is disabled,
- the user has no workspace membership.

## Safety behavior

P23H does not:

- Create users from the login page.
- Add sign-up behavior.
- Read sessions server-side.
- Read workspace memberships.
- Remove Basic Auth.
- Change dashboard access.
- Change middleware.
- Change database schema.
- Deploy.

## Important limitation

Dashboard protection is still unchanged.

A successful Better Auth login may create a session, but it does not replace Basic Auth or workspace access enforcement in this phase.

## Validation

P23H must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Next phase

The next safe phase is P23I.

P23I should plan server-side session reading before dashboard access is changed.

## Conclusion

P23H adds minimal real login submission to `/logga-in`.

It keeps dashboard protection, Basic Auth, database schema, and deployment unchanged.
