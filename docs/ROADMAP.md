# Proffera Roadmap

Proffera is the parent SaaS product for Swedish service businesses. The roadmap must protect the working lead/offert MVP while improving SaaS security, tenant isolation, booking/CRM workflows, workspace settings, services, and the separate Service AI Chat integration.

## Current baseline

- Public SaaS website exists and is deployed on `proffera.se`.
- Existing lead, company, matching, outbox, Brevo, mailto, and Neon persistence flows work and are protected.
- Dashboard customer and booking views exist and read real Neon data.
- Controlled dashboard write flows have been verified through customer creation, booking creation, status updates, customer events, customer notes, workspace settings, and workspace services.
- Phase 18.15 workspace settings is implemented and verified.
- Phase 18.16A workspace services read-only baseline is implemented and verified.
- Phase 18.16B service create/edit flow is implemented and verified.
- `workspace_services` currently supports create/edit/active-inactive from settings, but no dashboard delete action exists by design.
- Test service data from Phase 18.16B was cleaned from Neon after verification.

## Immediate priority: launch-readiness safeguards

- Verify `/dashboard` authentication and authorization before real customer usage.
- Remove access-code exposure from URLs, forms, screenshots, and logs.
- Replace `workspace_id = 'default'` before real multi-tenant onboarding.
- Add server-side validation and spam protection to public forms.
- Prevent dashboard/private routes from being indexed.
- Review canonical URLs, robots, sitemap, mobile navigation, and demo/contact conversion.
- Replace MVP/placeholder copy before real sales.

## Service AI Chat integration

Service AI Chat remains separate from Proffera.

- Domain: `chat.proffera.se`
- Tenant/client ID: `proffera`
- Rule: Iboren and Proffera messages/leads must never mix.

Current state:

- Widget is installed on the Proffera public website.
- Widget shows and AI replies.
- Inbox persistence/delivery to tenant `proffera` still needs final verification and, if needed, a small routing/storage patch.

Sequence:

1. **P-01:** Test tenant `proffera` on `chat.proffera.se`.
2. **P-02:** Install the tenant-scoped widget on the Proffera website. Status: implemented.
3. **P-03:** Verify message/lead delivery only to the Proffera inbox. Status: still open.
4. **P-04:** Add an AI Chat / Inbox link inside the Proffera dashboard.
5. **P-05:** Evaluate deeper integration only after stability and tenant isolation are proven.

No full merge, shared database migration, or large cross-project refactor is planned now.

## Phase 18 safety sequence

Historical and current boundaries:

- Phase 18.10: create customer form only; verified and cleaned.
- Phase 18.11: create booking form; accepted with documented limitation.
- Phase 18.12: controlled booking status update; verified.
- Phase 18.13: booking status event logging; verified.
- Phase 18.14: manual customer note flow; verified and cleaned.
- Phase 18.15: workspace settings DB and read/edit flow; verified.
- Phase 18.16: workspace service settings plan; verified as documentation baseline.
- Phase 18.16A: `workspace_services` migration, seed and read-only settings UI; verified.
- Phase 18.16B: service create/edit/active-inactive flow; verified and test data cleaned.
- Phase 18.17: documentation sync after Phase 18.15-18.16B.

Every dashboard write action requires:

- Server-side validation.
- Permission/access checks.
- One isolated write scope.
- Exact verification steps.
- Test-data cleanup or rollback plan.
- Confirmation that protected flows remain unchanged.

## Recommended next sequence

1. Finish Phase 18.17 documentation sync.
2. Verify/fix Service AI Chat inbox persistence for tenant `proffera`.
3. Add a dashboard link to the Proffera chat inbox only after tenant delivery is verified.
4. Harden dashboard authentication/authorization before any real customer data usage.
5. Improve public demo/contact conversion and replace MVP copy.

## Later product phases

Only after security and tenant isolation are reliable:

- Improve analytics and operational reporting.
- Add controlled AI assistant/inbox entry points.
- Add draft-first AI support with human review.
- Evaluate booking confirmations and reminders.
- Improve onboarding and workspace management.
- Add Stripe only after product packaging and access control are ready.

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

## Non-goals

- No full Service AI Chat merge.
- No shared cross-project database migration.
- No broad write-action rollout.
- No delete actions without a separate plan.
- No automatic email or AI sending without a reviewed workflow.
- No Stripe implementation before launch-readiness risks are addressed.
