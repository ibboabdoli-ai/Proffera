# Proffera Master Plan

## Product direction

Proffera is the parent SaaS product for Swedish service businesses. It is evolving from a working lead/offert marketplace MVP into a professional platform for booking, CRM, customers, leads, automation, analytics, and future AI support.

Target customers:

- Small and growing Swedish service businesses.
- Appointment-based and local service companies.
- Teams that need a simple system for inquiries, bookings, customer history, and follow-up.

Product promise:

- Capture leads and bookings online.
- Manage customers and follow-up in one workspace.
- Reduce manual administration.
- Add AI-assisted communication only when security, tenant isolation, and core workflows are stable.

## Core modules

- Leads and lead delivery
- Customers and CRM history
- Bookings and booking status
- Analytics and operational overview
- AI assistant / inbox entry points
- Workspace and company settings

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
- Controlled customer creation, booking creation, booking status update, and customer note flows.

Phase 18.10 was intentionally limited to the create-customer form only. That isolated-write pattern, including validation, permission checks, verification, and rollback, remains the standard for future dashboard write actions.

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
- Widget:

```html
<script src="https://chat.proffera.se/widget-v2.js" data-client-id="proffera"></script>
```

Tenant isolation rule:

- Proffera messages and leads must go only to tenant/client `proffera`.
- Iboren and Proffera messages or leads must never be mixed.

## Service AI Chat integration roadmap

- **P-01:** Test tenant `proffera` on `chat.proffera.se`.
- **P-02:** Install the widget on the Proffera website.
- **P-03:** Send a test message/lead and verify it appears only in the Proffera inbox.
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

1. Resolve high-impact website/security audit findings before real customer usage.
2. Run P-01 and verify strict Service AI Chat tenant isolation.
3. Review and verify the Phase 18.15 workspace-settings step without expanding its scope.
4. Improve the real demo/contact conversion flow and public trust copy.
5. Consider deeper AI or billing work only after authentication and tenant boundaries are reliable.

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
