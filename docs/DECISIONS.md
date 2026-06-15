# Architecture Decisions

This file records stable decisions for Proffera.

## ADR-0001 — Build original Proffera brand

- Status: Accepted
- Date: 2026-06-12

### Decision

Proffera must use an original brand, original Swedish copy, original UI, original layout and original product flows.

It must not copy Offerta or any other competitor's brand, text, layout, design or proprietary assets.

## ADR-0002 — Use phased delivery with approval gates

- Status: Accepted
- Date: 2026-06-12

### Decision

Work is delivered phase by phase.

Each phase must have:

- a clear goal
- a rollback point
- small commits
- verification before continuing

## ADR-0003 — Current MVP technology stack

- Status: Accepted
- Date: 2026-06-13

### Decision

The current MVP stack is:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Neon/Postgres
- Zod
- Vercel
- Brevo

Supabase is not used in the current implementation.

## ADR-0004 — Initial market and service categories

- Status: Accepted
- Date: 2026-06-12

### Decision

Initial market:

- Stockholm
- Södertälje

Initial service categories:

- Hemstädning
- Flyttstädning
- Kontorsstädning
- Fönsterputs
- Byggstädning
- Trädgård
- Flytthjälp
- Renovering

## ADR-0005 — Admin access model for MVP

- Status: Accepted
- Date: 2026-06-13

### Decision

Admin pages use an environment-based access code for MVP protection.

The value must never be committed or exposed.

This is not the long-term SaaS authorization model.

## ADR-0006 — Lead delivery model for MVP

- Status: Accepted
- Date: 2026-06-13

### Decision

Lead sending is currently supported through the protected admin delivery workflow, with Brevo email delivery and manual mailto fallback.

Sent status is tracked through an outbox log.

## ADR-0007 — Project memory files

- Status: Accepted
- Date: 2026-06-13

### Decision

Before new work, read these files:

- `docs/CURRENT_STATUS.md`
- `docs/DOCS_UPDATE_CHECKLIST.md`
- `docs/PROJECT_HANDOFF.md`
- `docs/PROJECT_LOG.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`

These files are the official project memory.

## ADR-0011 — Use one current-status document and concise phase logs

- Status: Accepted
- Date: 2026-06-14

### Decision

- `docs/CURRENT_STATUS.md` is the single source of current project status.
- `docs/DOCS_UPDATE_CHECKLIST.md` defines the required update workflow after each phase.
- New concise phase records belong under `docs/logs/`.
- `docs/PROJECT_LOG.md` remains the long historical log and should not be destructively rewritten.

### Reason

This reduces duplicated stale status text and makes documentation updates smaller, safer, and easier to review.

## ADR-0008 — Keep Service AI Chat separate from Proffera

- Status: Accepted
- Date: 2026-06-14

### Decision

Service AI Chat remains a separate project and deployment for now.

Proffera integrates with it through `chat.proffera.se` and the tenant-scoped widget using tenant/client ID `proffera`.

Do not perform a full merge, shared database migration, or large cross-project refactor.

### Reason

- Lower risk and easier rollback.
- Separate database and deployment boundaries.
- Reduced risk of breaking the Proffera website/dashboard.
- Clear tenant isolation.
- Iboren and Proffera messages or leads must never be mixed.

### Integration sequence

- P-01: Test tenant `proffera`.
- P-02: Install the widget on Proffera. Status: implemented.
- P-03: Verify messages/leads appear only in the Proffera inbox. Status: open.
- P-04: Add an AI Chat / Inbox dashboard link.
- P-05: Evaluate deeper integration only after stability is proven.

## ADR-0009 — Dashboard write actions must stay isolated

- Status: Accepted
- Date: 2026-06-14

### Decision

Dashboard write actions must remain small, isolated, server-validated, access-checked, and rollbackable.

Each write phase must specify exactly which table it may write to.

### Current accepted write scopes

- Customer creation writes only the intended customer scope.
- Booking creation writes only the intended booking scope.
- Booking status update writes only the intended booking/status/event scope.
- Manual customer note writes only the intended customer-event scope.
- Workspace settings writes only to `workspace_settings` for `workspace_id = 'default'`.
- Workspace service create/edit writes only to `workspace_services` for `workspace_id = 'default'`.

### Non-goals

- No broad dashboard write rollout.
- No dashboard delete actions without a separate approved plan.
- No automatic email, AI sending, Stripe, or cross-project writes without a reviewed workflow.

## ADR-0010 — Workspace settings and services use default workspace until auth/tenant model exists

- Status: Accepted
- Date: 2026-06-14

### Decision

During the MVP dashboard phase, workspace settings and workspace services use `workspace_id = 'default'`.

This is acceptable only while Proffera is a controlled MVP/demo workspace.

### Current implemented tables

- `workspace_settings`
- `workspace_services`

### Boundary

Before real multi-tenant onboarding, `workspace_id = 'default'` must be replaced with a trusted workspace identity derived from authentication/session state.

### Service management rule

Services can be created, edited, sorted and activated/deactivated from `/dashboard/installningar`.

Services cannot be deleted from the dashboard in Phase 18.16B. Delete requires a separate plan and cleanup policy.

## ADR-0012 — Proffera owns login and customer portal entry

- Status: Accepted
- Date: 2026-06-15

### Decision

The public `Logga in` entry must stay inside the Proffera website at `/logga-in`.

`/logga-in` must not redirect users directly to Service AI Chat.

Service AI Chat remains a separate widget/inbox engine, not the Proffera customer account or authentication system.

### Reason

- Proffera is the parent SaaS product and must own the customer journey.
- Customer accounts, dashboard access, workspace identity and subscription access should belong to Proffera.
- Service AI Chat is only one module/integration and should not define the main login experience.
- This keeps the long-term path open for real auth, roles, workspace binding and subscriptions inside Proffera.

### Boundary

P21 only creates/polishes the Proffera login entry. It does not implement real authentication, sessions, roles, billing, customer onboarding or workspace tenant binding.

## ADR-0013 — Temporarily protect dashboard before real auth

- Status: Accepted
- Date: 2026-06-15

### Decision

Until real SaaS authentication exists, `/dashboard` and `/dashboard/*` must be protected by temporary Basic Auth.

This is an interim launch-readiness safeguard only.

### Reason

- Dashboard pages read CRM, booking, customer, settings and service data from the MVP workspace.
- The dashboard must not be openly accessible before real customer authentication and workspace isolation exist.
- Temporary protection lowers exposure risk while the proper auth/session/workspace model is planned.

### Boundary

This does not implement real customer authentication, sessions, roles, billing, subscriptions or workspace tenant binding. It must be replaced before real multi-tenant customer onboarding.

## ADR-0014 — Use Better Auth with PostgreSQL/Neon for planned customer auth

- Status: Accepted
- Date: 2026-06-15

### Decision

The planned real customer authentication foundation for Proffera is Better Auth with PostgreSQL/Neon.

Better Auth should handle authentication and sessions. Proffera should keep ownership of workspace, workspace membership, role, plan/subscription and CRM/booking authorization tables.

### Reason

- Fits the current Next.js, TypeScript and Neon/Postgres stack.
- Avoids introducing Supabase as a second app platform.
- Avoids making a fully managed external provider the owner of Proffera's core workspace model.
- Avoids custom auth from scratch.
- Keeps the long-term customer journey and workspace access inside Proffera.

### Boundary

This decision does not add dependencies, code, routes or database migrations. Implementation starts in a separate approved phase.
