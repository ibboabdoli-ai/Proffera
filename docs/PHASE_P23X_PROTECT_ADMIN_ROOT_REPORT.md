# Phase P23X — Protect admin root report

## Goal
Protect `/admin` with the same Basic Auth gate already used for `/admin/*`, `/api/outbox`, and `/api/company-admin`.

## Changes
- Updated `shouldRequireAdminAuth` so `/admin` is protected.
- Kept `/admin/*`, `/api/outbox`, and `/api/company-admin` protection unchanged.
- Did not change dashboard auth behavior.

## Validation
- Confirmed before patch that `/admin` returned 200 while `/admin/foretag` and `/api/outbox` returned 401.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Notes
- No database changes.
- No dashboard Basic Auth reintroduction.
- No manual deploy in this phase.
