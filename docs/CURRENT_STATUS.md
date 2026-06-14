# Proffera Current Status

This file is the single source of truth for the current project state. Update it after every completed or materially changed phase.

Last updated: 2026-06-14

## Current completed phases

- Phase 18.15: Workspace settings save/edit completed.
- Phase 18.16A: Services read-only completed.
- Phase 18.16B: Services create/edit completed and tested.
- Phase 18.17: Documentation sync completed.

## Production status

- `main` is the production branch.
- Proffera is connected to Vercel production.
- The latest documentation sync deployed successfully after merge/push to `main`.
- Existing public website, dashboard, CRM/booking, lead, matching, outbox, Brevo, and mailto flows must remain protected.
- Service AI Chat remains a separate project at `chat.proffera.se`.

## Recommended next step

Choose one small, approved next step:

1. Fix and verify the Service AI Chat inbox flow and confirm strict tenant isolation for client `proffera`.
2. Address the highest-priority security and launch-readiness risks before real customer onboarding.

Do not start a full Service AI Chat merge or broad cross-project refactor.

## Open risks

- Verify `/dashboard` authentication and authorization before real customer usage.
- Admin and dashboard access codes must not leak through URLs, forms, screenshots, or logs.
- Replace `workspace_id = 'default'` before real multi-tenant onboarding.
- Public forms need server-side validation, rate limiting, and spam protection.
- Dashboard/private routes should not be indexed.
- Canonical URLs, robots rules, sitemap coverage, and mobile navigation need review.
- `Boka demo` should become a real booking/contact flow.
- MVP and placeholder copy should be replaced before real sales.
- Service AI Chat must keep Iboren and Proffera messages/leads strictly separated.

## Protected flows

Do not break:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log and duplicate prevention.
- Brevo lead email sending.
- Manual mailto fallback.
- Existing Neon/Postgres persistence.

## Update rule

After each phase, follow [`DOCS_UPDATE_CHECKLIST.md`](DOCS_UPDATE_CHECKLIST.md) and add a concise phase log under `docs/logs/`.
