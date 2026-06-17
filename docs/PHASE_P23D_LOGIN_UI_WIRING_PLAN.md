# P23D — Login UI wiring plan

Status: planned  
Date: 2026-06-17  
Type: documentation only  
Runtime changes: none  
Database changes: none  
Deployment: none  

## Purpose

This document defines the safe plan for wiring the public Proffera login UI to the Better Auth route added in P23B.

P23D does not change `/logga-in`, does not add form submission, does not create users, does not create sessions, does not remove Basic Auth, and does not deploy.

## Current state

The Better Auth route handler exists at:

`/api/auth/[...all]`

The route appears in the Next.js build output.

The public login page exists at:

`/logga-in`

The login page is still a placeholder and is not connected to Better Auth.

The dashboard and admin areas are still protected by temporary Basic Auth.

## Target user experience

The future login page should be simple, Swedish, and customer-facing.

Expected primary UI:

- Email field
- Password field
- Submit button
- Loading state
- Error message area
- Link or message for invited/pilot customers
- Clear note that access is for Proffera customers

Suggested Swedish labels:

- Page title: `Logga in`
- Email label: `E-post`
- Password label: `Lösenord`
- Submit button: `Logga in`
- Loading button text: `Loggar in...`
- Generic error: `Det gick inte att logga in. Kontrollera uppgifterna och försök igen.`
- Access note: `Inloggning är för Proffera-kunder med aktivt konto.`

## Future route interaction

The future login UI should use the Better Auth client/API only after route behavior is verified.

The expected flow is:

1. User enters email and password.
2. UI submits credentials to the Better Auth sign-in endpoint.
3. Better Auth creates a session cookie on success.
4. UI redirects the user to the correct post-login destination.
5. Later phases verify session and workspace membership before dashboard access is changed.

## Redirect behavior

Initial redirect target should be conservative.

Recommended first target:

`/dashboard`

Do not redirect to workspace-specific dashboard until workspace membership lookup exists.

Future workspace-aware redirect can be added after membership checks are implemented.

## Error handling plan

The login UI should avoid leaking sensitive details.

Use one generic error message for:

- Wrong email
- Wrong password
- Unknown account
- Disabled account
- Provider mismatch

Do not show whether an email exists.

## Loading and disabled states

During submit:

- Disable email field
- Disable password field
- Disable submit button
- Show loading text
- Prevent duplicate submissions

## Accessibility requirements

The future login form should include:

- Proper labels
- Required input attributes
- Keyboard-friendly submit
- Visible focus states
- Error message connected to form state
- No placeholder-only labels

## Security requirements

The future implementation must follow these rules:

- Do not log passwords.
- Do not log auth response tokens.
- Do not print secrets.
- Do not expose `DATABASE_URL`.
- Do not store passwords in client state longer than needed.
- Do not reveal whether an email exists.
- Do not remove Basic Auth in the same patch.
- Do not change dashboard access in the login UI patch.

## Proposed future phases

### P23E — Login UI static form draft

Add the visual login form without real submission.

Expected scope:

- Update `/logga-in` UI only.
- No real Better Auth request.
- No session handling.
- No dashboard access change.
- No Basic Auth removal.

### P23F — Better Auth client helper plan

Plan the client-side auth interaction.

Expected scope:

- Decide whether to use Better Auth client package or direct API call.
- Confirm installed package API.
- No UI runtime change.

### P23G — Login submit minimal patch

Wire login form submission after the client API is verified.

Expected scope:

- Submit email/password.
- Handle loading and generic errors.
- Redirect on success.
- No dashboard access change.
- No Basic Auth removal.

### P23H — Session read helper plan

Plan server-side session reading.

Expected scope:

- Define helper location.
- Define route/server component usage.
- No enforcement change.

### P23I — Workspace membership plan

Plan how authenticated users map to workspace access.

Expected scope:

- Membership lookup.
- Role checks.
- Redirect rules.
- No dashboard enforcement yet.

## Non-goals for P23D

P23D does not:

- Modify `/logga-in`.
- Add a form.
- Add auth client code.
- Submit credentials.
- Create users.
- Create sessions.
- Read sessions.
- Read workspace memberships.
- Remove Basic Auth.
- Change middleware.
- Change dashboard protection.
- Modify database schema.
- Deploy.

## Validation requirements for future implementation

Before a login UI runtime patch is merged, it must pass:

- `npm run lint`
- `npm run build`
- `git diff --check`

If a runtime login patch is created later, it must also be manually smoke-tested locally before deployment is considered.

## Conclusion

P23D is a planning-only phase.

The next safe implementation phase is P23E, which should add only a static login form draft without real authentication behavior.
