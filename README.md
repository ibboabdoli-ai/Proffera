# Proffera

Proffera is a Swedish service marketplace project for customers who want to submit service requests and compare offers from local providers.

## Project status

Current phase: **PHASE 00 — Discovery and repository bootstrap**

This repository is intentionally managed step by step. The project must not move to the next phase until the current phase is verified and explicitly approved.

## Core rules

- Build an original Swedish service marketplace inspired by the offer-comparison business model, without copying Offerta's brand, content, layout, design, or proprietary flows.
- Work phase by phase.
- Keep rollback points.
- Update `/docs/HANDOFF.md` after every phase.
- Do not deploy until the deployment phase is approved.
- Do not expose secrets in the repository.

## Planned stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Prisma
- Zod
- React Hook Form
- Vercel

## Initial market

- Sweden
- Stockholm
- Södertälje

## Initial service categories

- Hemstädning
- Flyttstädning
- Kontorsstädning
- Fönsterputs
- Byggstädning
- Trädgård
- Flytthjälp
- Renovering

## Documentation

Project control documents live in `/docs`.

Important files:

- `/docs/PROJECT_PLAN.md`
- `/docs/HANDOFF.md`
- `/docs/CHANGELOG.md`
- `/docs/DECISIONS.md`
- `/docs/DATABASE_SCHEMA.md`
- `/docs/TEST_CHECKLIST.md`
- `.env.example`
