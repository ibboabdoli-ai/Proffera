# P23R - Basic Auth transition plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23R defines the safe transition path for removing or reducing Basic Auth protection after the Better Auth dashboard gate and workspace access gate are verified.

## Current state

The production deployment is Ready.

The dashboard is still protected by Basic Auth on the public domain.

The Vercel deployment URL may also be protected by Vercel SSO.

This protection is expected and must remain in place until the application-level auth flow is verified end to end.

## Why Basic Auth must not be removed yet

The dashboard now uses Better Auth session gating and workspace access gating.

However, Basic Auth is still the outer safety layer.

Removing it too early could expose dashboard routes if the Better Auth flow, workspace membership data, or production environment configuration is incomplete.

## Required checks before removal

- Production deployment must be Ready.
- DATABASE_URL must be valid in production.
- BETTER_AUTH_SECRET must be configured and must not use the default Better Auth secret.
- BETTER_AUTH_URL must match the production origin.
- A real test user must be able to log in through `/logga-in`.
- The test user must have a valid workspace membership.
- `/dashboard` must render only after valid Better Auth session and workspace access.
- A logged-out request must redirect to `/logga-in` or remain blocked by the outer protection.
- A logged-in user without workspace access must see only the generic access-denied message.
- No dashboard route may reveal private customer, lead, booking, or workspace data without valid access.

## Safe transition sequence

1. Keep Basic Auth enabled.
2. Verify production environment variables.
3. Create or confirm a real test user.
4. Create or confirm workspace membership for that user.
5. Test `/logga-in` and `/dashboard` through the public production domain.
6. Test access-denied behavior with a user without workspace membership.
7. Only after successful verification, plan a separate runtime phase for Basic Auth removal or narrowing.

## Runtime removal must be separate

Basic Auth removal must not be mixed with other feature work.

The runtime removal phase must inspect the existing middleware or protection implementation before editing.

The runtime removal phase must have a rollback checkpoint.

The runtime removal phase must not change database schema.

The runtime removal phase must not deploy until local validation and PR review are complete.

## Rollback plan

If Basic Auth removal causes unsafe dashboard exposure or auth failures, immediately restore the previous protection implementation and redeploy the last known safe version.

## Validation for this documentation phase

- `git diff --check`
- content checks for Basic Auth safety and separate runtime removal phase

## Conclusion

P23R keeps Basic Auth in place and documents the required checks before any removal.

No runtime behavior is changed in this phase.
