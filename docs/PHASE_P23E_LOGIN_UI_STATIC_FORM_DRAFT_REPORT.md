# P23E — Login UI static form draft report

Status: completed  
Date: 2026-06-17  
Type: static UI draft  
Database changes: none  
Deployment: none  

## Purpose

This document records the P23E static login UI draft.

## Scope

P23E updates the `/logga-in` page from a placeholder status page to a static visual login form draft.

The form is intentionally disabled and does not submit credentials.

## Changed files

- `src/app/logga-in/page.tsx`
- `docs/PHASE_P23E_LOGIN_UI_STATIC_FORM_DRAFT_REPORT.md`

## UI changes

The `/logga-in` page now includes:

- Swedish customer-facing login copy.
- Static email field.
- Static password field.
- Disabled login button.
- Pilot customer guidance.
- Demo and contact links.
- Clear note that login is not active yet.

## Safety behavior

The form is not connected to Better Auth.

The form:

- Does not submit.
- Does not create a user.
- Does not create a session.
- Does not call `/api/auth`.
- Does not change dashboard access.
- Does not remove Basic Auth.

## Non-goals

P23E does not:

- Add real authentication.
- Add auth client logic.
- Submit credentials.
- Create sessions.
- Read sessions.
- Read workspace memberships.
- Remove Basic Auth.
- Change middleware.
- Change dashboard protection.
- Change database schema.
- Deploy.

## Validation

P23E must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

## Next phase

The next safe phase is P23F, which should plan the Better Auth client interaction before any real login submission is added.

## Conclusion

P23E adds only a static login form draft for `/logga-in`.

The user-facing page looks closer to the final login experience, but authentication behavior remains unchanged.
