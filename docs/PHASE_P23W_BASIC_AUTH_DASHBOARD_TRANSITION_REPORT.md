# Phase P23W — Basic Auth dashboard transition report

## Goal
Remove the temporary Basic Auth gate from `/dashboard` now that Better Auth login and workspace access checks protect dashboard routes.

## Changes
- Replaced dashboard Basic Auth middleware with a pass-through response that keeps `X-Robots-Tag: noindex, nofollow`.
- Kept admin/API Basic Auth unchanged for `/admin`, `/api/outbox`, and `/api/company-admin`.
- Dashboard protection now relies on the dashboard layout auth/session/workspace gate.

## Validation
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Notes
- No database schema changes.
- No Basic Auth removal for admin routes.
- No manual deploy in this phase.
