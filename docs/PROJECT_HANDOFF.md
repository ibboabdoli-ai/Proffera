# Proffera Project Handoff

Project: Proffera

Repository: `ibboabdoli-ai/Proffera`

Role: Parent SaaS product for Swedish service businesses

Stack: Next.js App Router, TypeScript, Tailwind CSS, Neon/Postgres, Zod, Vercel, Brevo

UI language: Swedish

## Current status

See [`CURRENT_STATUS.md`](CURRENT_STATUS.md) for completed phases, production status, current risks, and the recommended next safe step.

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

- `docs/CURRENT_STATUS.md`
- `docs/DOCS_UPDATE_CHECKLIST.md`
- `docs/MASTER_PLAN.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_LOG.md`
- `docs/logs/`
