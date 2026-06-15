# P22A — Dashboard temporary Basic Auth

Status: completed.

Date: 2026-06-15

## Goal

Add a temporary protection layer to `/dashboard` and `/dashboard/*` before real customer authentication exists.

## Built

- Added Basic Auth protection for `/dashboard` and `/dashboard/*` in middleware.
- Dashboard authentication uses `DASHBOARD_ACCESS_CODE` when configured.
- If `DASHBOARD_ACCESS_CODE` is not configured, it falls back to `ADMIN_ACCESS_CODE`.
- Kept `X-Robots-Tag: noindex, nofollow` on dashboard responses.
- Kept `/app/*` and `/api/widget-config` Service AI Chat redirects unchanged.
- Kept admin Basic Auth behavior separate from dashboard protection.

## Scope boundaries

No changes were made to:

- Database schema or data.
- Customer creation.
- Booking creation.
- Booking status updates.
- Customer history.
- Quote requests.
- Company registrations.
- Lead matching.
- Brevo/email delivery.
- Public marketing pages.
- Service AI Chat repository.

## Verification

Code inspection completed for middleware behavior.

Local commands were not run in this environment:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Production verification still requires checking that `/dashboard` asks for Basic Auth after Vercel deploy succeeds.

## Rollback

Rollback point before this phase:

- `fe443304c4b63cba91ef76b83480513056ee4160`

If needed, revert the P22A commits that changed:

- `src/middleware.ts`
- documentation files updated for P22A
