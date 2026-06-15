# Proffera Current Status

This file is the single source of truth for the current project state. Update it after every completed or materially changed phase.

Last updated: 2026-06-15

Active phase history is stored under `docs/logs/`. `docs/PROJECT_LOG.md` is a legacy/reference history file and is not required for normal phase updates.

## Current completed phases

- Phase 18.15: Workspace settings save/edit completed.
- Phase 18.16A: Services read-only completed.
- Phase 18.16B: Services create/edit completed and tested.
- Phase 18.17: Documentation sync completed.
- Phase 18.17B: Documentation workflow cleanup completed and merged through PR #12.
- Phase 18.17C: Documentation workflow hardening completed and merged through PR #17.
- P21: Proffera login entry foundation completed. Public `Logga in` now stays inside Proffera at `/logga-in`; no real auth was added.

## Production status

- `main` is the production branch.
- Proffera is deployed on `proffera.se` through Vercel production.
- Phase 18.17B was merged through PR #12 and its Vercel production deployment completed successfully.
- Phase 18.17C was merged through PR #17 and its Vercel production deployment completed successfully.
- Workspace settings save/edit and workspace services read/create/edit/active-inactive flows are deployed and verified.
- Dashboard service deletion remains intentionally unavailable.
- Phase 18.16B temporary test service data was cleaned from Neon after verification.
- Existing public website, dashboard, CRM/booking, lead, matching, outbox, Brevo, and mailto flows must remain protected.
- `/logga-in` is now a Proffera-owned customer portal entry page, not a redirect to `chat.proffera.se`.
- Service AI Chat remains a separate project at `chat.proffera.se`.
- The Service AI Chat widget is installed and can answer, but Proffera inbox persistence/delivery still needs final verification or a small fix.

## Recommended next step

Choose one small, approved next step:

1. Address the highest-priority security and launch-readiness risks before real customer onboarding, starting with dashboard authentication/authorization planning.
2. Later, verify Service AI Chat inbox persistence for client `proffera`, then confirm strict tenant isolation.

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
- Access-code based dashboard writes are an MVP-only control, not a durable SaaS authorization model.
- `/logga-in` is only a portal entry placeholder; real customer authentication, session handling, roles, and workspace binding are not implemented yet.

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
