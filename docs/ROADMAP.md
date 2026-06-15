# Proffera Roadmap

Proffera is the parent SaaS product for Swedish service businesses. The roadmap must protect the working lead/offert MVP while improving SaaS security, tenant isolation, booking/CRM workflows, workspace settings, services, and the separate Service AI Chat integration.

## Current status

See [`CURRENT_STATUS.md`](CURRENT_STATUS.md) for completed phases, production status, open risks, and the recommended next safe step.

Recent completed step:

- P21: Public `Logga in` now stays inside Proffera at `/logga-in`. Real authentication is still not implemented.

## Immediate priority: launch-readiness safeguards

- Plan and implement real `/dashboard` authentication and authorization before real customer usage.
- Remove access-code exposure from URLs, forms, screenshots, and logs.
- Replace `workspace_id = 'default'` before real multi-tenant onboarding.
- Add server-side validation and spam protection to public forms.
- Prevent dashboard/private routes from being indexed.
- Review canonical URLs, robots, sitemap, mobile navigation, and demo/contact conversion.
- Replace MVP/placeholder copy before real sales.
- Replace the `/logga-in` placeholder with a proper auth/session/customer portal flow.

## Service AI Chat integration

Service AI Chat remains separate from Proffera.

- Domain: `chat.proffera.se`
- Tenant/client ID: `proffera`
- Rule: Iboren and Proffera messages/leads must never mix.

Current state:

- Widget is installed on the Proffera public website.
- Widget shows and AI replies.
- Inbox persistence/delivery to tenant `proffera` still needs final verification and, if needed, a small routing/storage patch.
- Service AI Chat is not the Proffera login/customer account system.

Sequence:

1. **P-01:** Test tenant `proffera` on `chat.proffera.se`.
2. **P-02:** Install the tenant-scoped widget on the Proffera website. Status: implemented.
3. **P-03:** Verify message/lead delivery only to the Proffera inbox. Status: still open.
4. **P-04:** Add an AI Chat / Inbox link inside the Proffera dashboard.
5. **P-05:** Evaluate deeper integration only after stability and tenant isolation are proven.

No full merge, shared database migration, or large cross-project refactor is planned now.

## Phase safety rule

Every dashboard write action requires:

- Server-side validation.
- Permission/access checks.
- One isolated write scope.
- Exact verification steps.
- Test-data cleanup or rollback plan.
- Confirmation that protected flows remain unchanged.

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
