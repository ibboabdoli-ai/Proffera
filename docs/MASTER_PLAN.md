# Proffera Master Plan

## Product direction

Proffera is the parent SaaS product for Swedish service businesses. It is evolving from a working lead/offert marketplace MVP into a professional platform for booking, CRM, customers, leads, automation, analytics, workspace settings, service management, and future AI support.

Target customers:

- Small and growing Swedish service businesses.
- Appointment-based and local service companies.
- Teams that need a simple system for inquiries, bookings, customer history, services, and follow-up.

Product promise:

- Capture leads and bookings online.
- Manage customers, bookings, services, and follow-up in one workspace.
- Reduce manual administration.
- Add AI-assisted communication only when security, tenant isolation, and core workflows are stable.

## Core modules

- Leads and lead delivery
- Customers and CRM history
- Bookings and booking status
- Workspace services
- Workspace and company settings
- Analytics and operational overview
- AI assistant / inbox entry points

## Current foundation

Built and protected:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log and duplicate prevention.
- Brevo lead email delivery.
- Manual mailto fallback.
- Existing Neon/Postgres persistence.
- Public SaaS website.
- Dashboard customer, booking, and history views.
- Controlled customer creation, booking creation, booking status update, customer-event, and customer-note flows.
- Workspace settings read/edit flow for `workspace_settings`.
- Workspace service read/create/edit/active-inactive flow for `workspace_services`.

Phase 18.10 established the isolated-write pattern. That pattern, including validation, permission checks, verification, and rollback/cleanup, remains the standard for future dashboard write actions.

## Current Phase 18 status

- Phase 18.10 create customer: verified and cleaned.
- Phase 18.11 create booking: accepted with documented limitation.
- Phase 18.12 booking status update: verified.
- Phase 18.13 event logging: verified.
- Phase 18.14 customer note: verified and cleaned.
- Phase 18.15 workspace settings: implemented and verified.
- Phase 18.16 services plan: merged as documentation baseline.
- Phase 18.16A workspace services read-only DB baseline: implemented, migrated, seeded, and verified.
- Phase 18.16B workspace services create/edit: implemented, deployed, verified, and test data cleaned.
- Phase 18.17 documentation sync: current step.

## Architecture decision: Service AI Chat stays separate

Service AI Chat is a separate chat/widget/inbox/lead-capture engine in `ibboabdoli-ai/service-ai-chat`.

It must not be fully merged into Proffera now.

Reasons:

- Lower implementation and deployment risk.
- Cleaner rollback.
- Separate database boundaries.
- Reduced risk of tenant-data conflicts.
- Avoid breaking the Proffera production website and dashboard.
- Keep both systems independently stable.

Current integration model:

- Domain: `chat.proffera.se`
- Tenant/client ID: `proffera`
- Widget installed on Proffera public site.
- Widget can show and answer, but message/lead persistence into the Proffera inbox still needs final verification.

Tenant isolation rule:

- Proffera messages and leads must go only to tenant/client `proffera`.
- Iboren and Proffera messages or leads must never be mixed.

## Service AI Chat integration roadmap

- **P-01:** Test tenant `proffera` on `chat.proffera.se`.
- **P-02:** Install the widget on the Proffera website. Status: implemented.
- **P-03:** Send a test message/lead and verify it appears only in the Proffera inbox. Status: open.
- **P-04:** Add an AI Chat / Inbox link inside the Proffera dashboard.
- **P-05:** Evaluate deeper integration only after the separate integration is stable.

Each step requires a rollback point and deployment/status verification before continuing.

## SaaS and security readiness principles

- Authenticate and authorize private dashboard and admin routes.
- Derive workspace/tenant identity from a trusted authenticated session.
- Do not use `workspace_id = 'default'` for real multi-tenant onboarding.
- Keep secrets out of URLs, forms, screenshots, logs, and documentation.
- Add server-side validation and spam protection to public forms.
- Use one controlled write scope per phase.
- Require validation, permission checks, verification, and rollback for every write action.
- Do not index dashboard/private routes.
- Review legal copy and data handling before larger-scale onboarding.

## Protected flows

Do not break:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log.
- Outbox duplicate prevention.
- Brevo lead email sending.
- Manual mailto fallback.
- Existing Neon/Postgres persistence.

## Current execution priorities

1. Finish documentation sync after Phase 18.15-18.16B.
2. Verify/fix Service AI Chat tenant `proffera` inbox persistence.
3. Add an AI Chat / Inbox dashboard link only after P-03 is verified.
4. Harden dashboard authentication and authorization before real customer usage.
5. Improve real demo/contact conversion flow and public trust copy.
6. Consider deeper AI or billing work only after authentication and tenant boundaries are reliable.

## Non-goals for now

- No full Service AI Chat merge.
- No shared cross-project database migration.
- No large cross-project refactor.
- No broad dashboard write expansion.
- No delete actions without a separate plan.
- No automatic booking emails without a reviewed communication plan.
- No Stripe implementation before security, product packaging, and onboarding are ready.
- No autonomous AI sending.

## Stack direction

- Next.js App Router
- TypeScript
- Tailwind CSS
- Neon/Postgres
- Zod
- Vercel
- Brevo

Do not describe Supabase or Prisma as the current main stack.
