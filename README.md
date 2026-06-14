# Proffera

Proffera is the parent SaaS product for Swedish service businesses. It combines a public marketing website with tools for leads, customers, bookings, CRM workflows, automation, and future AI support.

Proffera started as a Swedish lead/offert marketplace MVP. The current direction is a professional SaaS platform that helps service businesses manage the full path from first inquiry to ongoing customer relationship.

## Current status

See [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) for completed phases, production status, open risks, and the recommended next safe step.

## Product modules

- Leads
- Customers / kunder
- Bookings / bokningar
- CRM and customer history
- Analytics
- AI assistant and inbox entry points
- Workspace settings

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Neon/Postgres
- Zod
- Vercel
- Brevo for lead email delivery

Supabase and Prisma are not the current main stack.

## Related project: Service AI Chat

Service AI Chat is a separate related project:

- Repository: `ibboabdoli-ai/service-ai-chat`
- Purpose: chat widget, inbox, lead capture, tenant settings, and email notifications
- Domain: `https://chat.proffera.se`
- Proffera tenant/client ID: `proffera`

Service AI Chat must remain separate from Proffera for now. Do not perform a full merge, shared database migration, or large cross-project refactor.

Planned widget integration:

```html
<script src="https://chat.proffera.se/widget-v2.js" data-client-id="proffera"></script>
```

Tenant isolation is mandatory: Iboren and Proffera messages or leads must never be mixed.

Integration sequence:

1. P-01: Test tenant `proffera` on `chat.proffera.se`.
2. P-02: Install the widget on the Proffera website.
3. P-03: Verify messages and leads appear only in the Proffera inbox.
4. P-04: Add an AI Chat / Inbox link inside the Proffera dashboard.
5. P-05: Evaluate deeper integration only after the separate setup is stable.

## Safety rules

- Keep changes small, phase-based, and easy to roll back.
- Protect existing quote, company, matching, outbox, Brevo, mailto, and Neon persistence flows.
- Do not add broad dashboard write access without validation, permission checks, and a rollback plan.
- Verify `/dashboard` protection before real customer usage.
- Do not expose access codes, secrets, or tenant data.
- Check deployment status after each approved production change.

Phase 18.10 was intentionally limited to the create-customer form only. It is now complete and verified; it remains the model for isolating future write actions.

## Documentation

- [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md)
- [`docs/DOCS_UPDATE_CHECKLIST.md`](docs/DOCS_UPDATE_CHECKLIST.md)
- [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)
- [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/PROJECT_LOG.md`](docs/PROJECT_LOG.md)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)
- [`docs/TEST_CHECKLIST.md`](docs/TEST_CHECKLIST.md)
