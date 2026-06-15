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
- Customer login and workspace access

## Current status

See [`CURRENT_STATUS.md`](CURRENT_STATUS.md) for completed phases, production status, current risks, and the recommended next safe step.

## Architecture decision: Proffera owns customer login

The public `Logga in` route belongs to Proffera and should remain on `proffera.se`.

Current state:

- `/logga-in` is a Proffera customer portal entry placeholder.
- Real authentication, sessions, roles, customer accounts, subscription access and workspace binding are not implemented yet.
- Service AI Chat must not become the Proffera customer account/login system.

Long-term direction:

- Customer identity and workspace access should be derived from a trusted authenticated Proffera session.
- The dashboard should be protected before real customer data is used.
- `workspace_id = 'default'` must be replaced before real multi-tenant onboarding.

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
