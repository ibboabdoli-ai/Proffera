# Architecture Decisions

This file records project decisions. Every major decision must include context, decision, status, and consequences.

## ADR-0001 — Build original Proffera brand

- Status: Accepted
- Date: 2026-06-12

### Context

The project is inspired by the general Swedish service-marketplace model where customers submit requests and compare provider offers.

### Decision

Proffera must use an original brand, original Swedish copy, original UI, original layout, and original product flows. It must not copy Offerta or any other competitor's brand, texts, design, layout, or proprietary assets.

### Consequences

- Competitor websites can be used only for market understanding.
- All customer-facing copy must be written from scratch.
- Visual design must be distinct.

## ADR-0002 — Use phased delivery with approval gates

- Status: Accepted
- Date: 2026-06-12

### Context

The user wants the project controlled from 0 to 100 without losing track of progress.

### Decision

The project will be delivered phase by phase. Work must stop after every phase and wait for explicit approval before continuing.

### Consequences

- Lower risk of uncontrolled changes.
- Easier rollback and verification.
- Slower but safer development flow.

## ADR-0003 — Preferred MVP technology stack

- Status: Proposed
- Date: 2026-06-12

### Context

The project needs a modern, deployable, full-stack setup suitable for Vercel and Swedish marketplace flows.

### Decision

The preferred stack is:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Prisma
- Zod
- React Hook Form
- Vercel

### Consequences

- Final stack must be confirmed in Phase 01 before app implementation.
- Supabase environment variables must never be committed.
- Database schema and migrations must be documented.

## ADR-0004 — Initial market and service categories

- Status: Accepted
- Date: 2026-06-12

### Decision

Initial market:

- Stockholm
- Södertälje

Initial categories:

- Hemstädning
- Flyttstädning
- Kontorsstädning
- Fönsterputs
- Byggstädning
- Trädgård
- Flytthjälp
- Renovering
