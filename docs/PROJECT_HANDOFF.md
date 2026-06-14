# Proffera Project Handoff

Project: Proffera

Repository: `ibboabdoli-ai/Proffera`

Role: Parent SaaS product for Swedish service businesses

Stack: Next.js App Router, TypeScript, Tailwind CSS, Neon/Postgres, Zod, Vercel, Brevo

UI language: Swedish

## Exact current status

Proffera has moved beyond the original lead/offert marketplace MVP and now has a public SaaS website plus an early CRM/booking dashboard.

Latest known phase state:

- Phase 18.10 create-customer form: verified and cleaned back to demo baseline.
- Phase 18.11 create-booking form: accepted with a documented detail-page verification limitation.
- Phase 18.12 controlled booking status update: verified and rolled back to baseline.
- Phase 18.13 booking status customer-event logging: verified.
- Phase 18.14 manual customer note flow: verified and cleaned back to baseline.
- Phase 18.15 workspace settings: planned; migration file added, but full settings implementation and verification are not documented as complete.

Phase 18.10 was deliberately limited to the create-customer form only. It is the reference pattern for isolated dashboard writes. Do not broaden write actions without separate validation, permission, verification, and rollback plans.

## What is already built

Public/product:

- Public SaaS marketing website and legal pages.
- Dashboard shell and module routes.
- Customers, bookings, customer profiles, booking profiles, and customer history.
- Controlled create-customer, create-booking, booking-status, and customer-note actions.
- Settings preview and Phase 18.15 migration preparation.

Existing protected MVP:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log.
- Outbox duplicate prevention.
- Brevo lead email sending.
- Manual mailto fallback.
- Neon/Postgres persistence.

## Read-only, demo, or incomplete areas

- Some dashboard and public marketing content remains preview/demo-oriented.
- `/dashboard/leads` and `/dashboard/ai-assistent` are not complete product modules.
- Workspace settings UI is not documented as fully implemented or verified.
- Customer/booking data model still relies on the temporary/default workspace approach.
- Public demo/contact flow is not yet a real low-friction booking flow.
- Placeholder/MVP trust copy remains on public pages.

## What must not be touched without a separate approved plan

- Existing quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log and duplicate prevention.
- Brevo lead delivery.
- Manual mailto fallback.
- Existing Neon/Postgres persistence and tables.
- Service AI Chat database or tenant model.
- Broad dashboard write actions, deletes, email sending, Stripe, or deep AI integration.

## Related project: Service AI Chat

Service AI Chat remains a separate system:

- Repository: `ibboabdoli-ai/service-ai-chat`
- Domain: `chat.proffera.se`
- Domain status: connected to the Service AI Chat Vercel project; SSL working.
- Proffera tenant/client ID: `proffera`
- Planned widget:

```html
<script src="https://chat.proffera.se/widget-v2.js" data-client-id="proffera"></script>
```

Architecture rule:

- No full merge now.
- No shared database migration now.
- No large cross-project refactor.
- Iboren and Proffera messages or leads must never be mixed.
- Proffera messages/leads must appear only under tenant/client `proffera`.

Integration sequence:

- P-01: Test tenant `proffera` on `chat.proffera.se`.
- P-02: Install the widget on the Proffera website.
- P-03: Verify a test message/lead appears only in the Proffera inbox.
- P-04: Add an AI Chat / Inbox link inside the Proffera dashboard.
- P-05: Evaluate deeper integration only after stability and tenant isolation are proven.

## Current website/security audit notes

- Verify `/dashboard` protection before real customer usage.
- Admin access code must not leak through URLs, forms, screenshots, or logs.
- Avoid `workspace_id = 'default'` for real SaaS multi-tenant usage.
- Public forms need server-side validation and spam protection.
- `Boka demo` should become a real booking/contact flow.
- Mobile navigation should be checked and improved.
- Canonical URLs, robots rules, and sitemap coverage should be reviewed.
- Dashboard/private routes should not be indexed.
- MVP/placeholder copy should be replaced before real sales.

These findings are launch-readiness risks. Do not treat existing preview/demo routes as ready for real customer data until authentication and tenant boundaries are verified.

## Current risks

- Dashboard routes may expose private CRM data if not protected correctly.
- Access-code handling is not a durable SaaS authorization model.
- Hardcoded/default workspace behavior is not safe multi-tenant isolation.
- Public forms can attract spam or abuse without rate limiting and spam controls.
- Separate projects can mix tenant data if `data-client-id="proffera"` is not verified end-to-end.
- Phase documents and production state can drift unless each approved change updates this handoff.

## Immediate next steps

Chat integration:

- Run P-01 first: test tenant/client `proffera` on `chat.proffera.se`.
- Confirm messages/leads appear only in the Proffera inbox.
- Prepare a rollback point before P-02.

Proffera product:

- Review the Phase 18.15 migration and settings scope before any further implementation.
- Verify dashboard protection and access-code exposure before real customer usage.
- Keep any next write action isolated and reversible.

Historical phase boundary:

- Phase 18.10 was create-customer form only, with no booking flow, deletes, email sending, Stripe, or deep AI merge in that phase.

## Verification checklist

Before any approved Proffera change:

- Confirm the changed scope is small and documented.
- Confirm protected MVP flows remain unchanged.
- Confirm server-side validation and permission checks for writes.
- Confirm tenant/workspace boundaries.
- Confirm no secrets appear in URLs, rendered HTML, screenshots, or logs.
- Run lint/build checks.
- Test relevant routes on mobile and desktop.
- Verify Vercel deployment/status after an approved deployment.
- Verify real data was not mixed with demo/test data.
- Verify rollback steps before moving to the next phase.

For Service AI Chat integration:

- Confirm `chat.proffera.se` and SSL work.
- Confirm widget uses `data-client-id="proffera"`.
- Send a Proffera test message and lead.
- Confirm both appear only in the Proffera inbox.
- Confirm no Iboren data appears in the Proffera tenant and no Proffera data appears in Iboren.
- Stop and roll back if tenant isolation is uncertain.

## Rollback expectations

- Create a rollback point before each implementation step.
- Keep one functional change per step.
- Document exact test data and cleanup steps.
- Restore demo baseline after write-flow verification.
- Revert the small change if verification fails.
- Do not continue to the next P-step or product phase until the current step is verified.

## Important documentation

- `docs/MASTER_PLAN.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_LOG.md`
- `docs/PHASE_18_10_CREATE_CUSTOMER_FORM_VERIFICATION.md`
- `docs/PHASE_18_11_CREATE_BOOKING_FORM_VERIFICATION.md`
- `docs/PHASE_18_12_STATUS_UPDATE_VERIFICATION.md`
- `docs/PHASE_18_13_EVENT_LOGGING_VERIFICATION.md`
- `docs/PHASE_18_14_VERIFICATION.md`
- `docs/PHASE_18_15_SETTINGS_COMPANY_PROFILE_PLAN.md`
