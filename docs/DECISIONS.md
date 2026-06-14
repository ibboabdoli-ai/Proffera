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

## ADR-0006 — Lead delivery model for MVP

- Status: Accepted
- Date: 2026-06-13

### Decision

Lead sending is currently manual through mailto.

Sent status is tracked through an outbox log.

A real email provider is planned for a later phase.

## ADR-0007 — Project memory files

- Status: Accepted
- Date: 2026-06-13

### Decision

Before new work, read these files:

- `docs/PROJECT_HANDOFF.md`
- `docs/PROJECT_LOG.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`

These files are the official project memory.

## ADR-0008 — Keep Service AI Chat separate from Proffera

- Status: Accepted
- Date: 2026-06-14

### Decision

Service AI Chat remains a separate project and deployment for now.

Proffera will integrate with it through `chat.proffera.se` and the tenant-scoped widget:

```html
<script src="https://chat.proffera.se/widget-v2.js" data-client-id="proffera"></script>
```

Do not perform a full merge, shared database migration, or large cross-project refactor.

### Reason

- Lower risk and easier rollback.
- Separate database and deployment boundaries.
- Reduced risk of breaking the Proffera website/dashboard.
- Clear tenant isolation.
- Iboren and Proffera messages or leads must never be mixed.

### Integration sequence

- P-01: Test tenant `proffera`.
- P-02: Install the widget on Proffera.
- P-03: Verify messages/leads appear only in the Proffera inbox.
- P-04: Add an AI Chat / Inbox dashboard link.
- P-05: Evaluate deeper integration only after stability is proven.
