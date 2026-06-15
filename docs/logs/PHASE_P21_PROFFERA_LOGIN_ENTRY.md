# P21 — Proffera login entry foundation

Status: completed.

Date: 2026-06-15

## Goal

Keep the public login entry inside the Proffera website instead of sending users directly to the separate Service AI Chat app.

## Built

- Changed the public header `Logga in` link to `/logga-in`.
- Removed the `/logga-in` middleware redirect to `chat.proffera.se`.
- Polished `/logga-in` as a Proffera customer portal entry page.
- Added `noindex, nofollow` metadata for the login placeholder page.

## Scope boundaries

No changes were made to:

- Database schema or data.
- Dashboard CRM/booking flows.
- Admin flow.
- Quote requests.
- Company registrations.
- Lead matching.
- Brevo/email delivery.
- Service AI Chat repository.

## Verification

Code inspection completed for the changed files.

Local commands were not run in this environment:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Rollback

Rollback point before this phase:

- `e09f8d2e9eb18103e19010f3180ca3bc082ac024`

If needed, revert the P21 commits that changed:

- `src/components/layout/header.tsx`
- `src/middleware.ts`
- `src/app/logga-in/page.tsx`
- documentation files updated for P21
