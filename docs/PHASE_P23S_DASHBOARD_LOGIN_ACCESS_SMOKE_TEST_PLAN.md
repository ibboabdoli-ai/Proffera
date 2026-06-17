# P23S - Dashboard login and access smoke test plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23S defines the smoke test plan for the production dashboard login and workspace access flow before any Basic Auth removal.

## Current state

The dashboard has Better Auth session gating.
The dashboard has workspace access gating through `getUserWorkspaceAccess()`.
Production deployment is Ready.
Basic Auth is still active on the public dashboard domain and must remain active during this smoke test planning phase.

## Required smoke tests

### 1. Logged-out user

Expected behavior:

- `/dashboard` should not expose dashboard content.
- The user should be redirected to `/logga-in` by application auth, or blocked by the outer Basic Auth layer before the app is reached.

### 2. Valid logged-in user with workspace membership

Expected behavior:

- The user can sign in through `/logga-in`.
- The user has an active or trial workspace membership.
- `/dashboard` renders the dashboard shell and dashboard pages.
- No private data from another workspace is visible.

### 3. Logged-in user without workspace membership

Expected behavior:

- The user should not see dashboard data.
- The user should see only the generic Swedish access-denied message.
- The response must not reveal whether a workspace, membership, plan, role, or user record exists.

### 4. Invalid or missing production environment values

Expected behavior:

- The app must fail closed.
- Dashboard data must not be exposed.
- Production environment variables must be corrected before Basic Auth removal.

## Test prerequisites

- A real test user exists in Better Auth.
- The test user can sign in with email/password.
- A valid workspace exists.
- A workspace membership exists for the positive test user.
- A second user without workspace membership exists for negative testing.
- Production `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` are configured.

## Safety rules

P23S does not change runtime code.
P23S does not deploy.
P23S does not modify middleware.
P23S does not remove Basic Auth.
P23S does not change database schema.
P23S does not create or mutate production users, workspaces, or memberships.

## Future runtime phases

After this plan, a separate phase may prepare test data or document manual test execution.
Basic Auth removal must remain a separate later phase after successful smoke testing.

## Validation for this documentation phase

- `git diff --check`
- content checks for smoke test coverage and Basic Auth safety

## Conclusion

P23S documents the login and workspace access smoke tests required before any Basic Auth transition.
No runtime behavior is changed in this phase.
