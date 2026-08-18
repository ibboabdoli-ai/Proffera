# Proffera Current Status

Last updated: 2026-08-18

This is the canonical factual status document for Proffera. For worker rules, live task state, current `main` SHA, and roadmap order, also read `AGENTS.md`, GitHub issue #548, GitHub issue #276, and `docs/README.md`.

## Release baseline

- Repository: `ibboabdoli-ai/Proffera`
- Default branch: `main`
- Vercel project: `proffera-jhap`
- Runtime: Next.js on Node.js 22.x

Do not pin the current `main` SHA or current Vercel deployment ID in this file: those values change on every merge and would make the canonical status stale immediately. GitHub issue #548 is the live control board for the current baseline. A source merge is not proof of a live release; Production claims require the matching Vercel Production deployment and affected runtime behavior to be verified.

## Current product state

The repository contains active production implementations for these major areas:

- Better Auth sign-in/session handling and Workspace membership/RBAC.
- Workspace-scoped Dashboard data for customers, bookings, leads, offers, reviews, billing and service work.
- Public Booking, availability, email verification, booking management and customer portal foundations.
- Quote Request / Offer flows and Service Job lifecycle foundations.
- Verified Review invitation, token, moderation and publication protections.
- Stripe Checkout, Customer Portal, subscription webhook synchronization and billing-alert foundations.
- Company Directory ingestion, official-facts verification, SNI/category mapping, publication safety gates and admin review flows.
- Public marketplace/search foundations and provider marketplace activation.

Recent Production changes independently verified through matching `main` deployments on 2026-08-18 include:

- #599 — connect existing providers to the marketplace.
- #601 — prevent new Company Directory profiles from starving behind the existing refresh backlog and prioritize unprofiled companies.
- #602 — fix the Booking reminder Workspace UUID join and cover it with regression tests.

## Delivery and AI-control system

Current control plane:

1. `AGENTS.md` — mandatory Graph Engineering worker protocol.
2. GitHub issue #548 — live AI Supervisor control board, including current `main` baseline and active queue.
3. GitHub issue #276 — execution roadmap/dependency order.
4. `docs/CURRENT_STATUS.md` — stable factual project status.
5. `docs/README.md` — documentation authority map.

Current merge-safety rules include:

- pull request required before merge;
- AI/product branches must use `work/proffera-*`;
- PRs must declare `Documentation impact: updated` or `Documentation impact: none`;
- `Documentation impact: updated` requires this canonical status file to change in the same PR;
- required `Validate` check;
- required `E2E public smoke` check;
- no force push / protected default branch behavior;
- gated automerge requires a fresh owner-applied `ibbo-approved` authorization after the current head commit and must not be treated as AI self-approval.

Dependency-bot branches are handled separately by automation.

## CI and browser testing

`Validate` covers:

- governance checks;
- dependency install;
- ESLint;
- TypeScript typecheck;
- Vitest/test suite;
- Company Directory discovery-worker Python validation;
- Next.js production build;
- whitespace validation.

Playwright browser E2E is automated in CI through `E2E public smoke`.

Committed non-destructive browser coverage includes:

- public marketing/marketplace smoke coverage;
- public nearby/geolocation coverage;
- the real Login page entry surface;
- Quote intake through service selection and adaptive-details navigation without submitting a request.

An opt-in isolated Preview harness also exists for:

- two-account Workspace visibility/isolation smoke checks;
- read-only rendering of a dedicated published Booking page.

Those authenticated/Booking checks intentionally skip unless dedicated Preview E2E credentials/workspace names/booking slug are supplied. They must not become required CI until Preview is proven isolated from Production for database, auth, email, payments and customer data.

Still intentionally excluded from state-changing browser automation until that isolation is proven:

- Booking → email verification → confirmation;
- Quote Request → Offer → Accept/Reject;
- Stripe/payment lifecycle;
- destructive Admin mutations.

Do not run destructive or uncertain browser tests against Production or real customer Workspaces.

## Database tenant defense

The last independently verified Production database-hardening audit (2026-08-08) established:

- validated tenant-relation constraints;
- removal of active legacy `workspace_id='default'` seed rows;
- zero rechecked cross-Workspace relation violations for the audited edges.

The architectural RLS blocker from that audit remains the safe assumption until reverified and changed deliberately:

1. application traffic used a table-owning / BYPASSRLS-capable role;
2. requests did not yet establish a transaction-scoped Workspace context in PostgreSQL;
3. Production RLS must not be enabled until a restricted application role and tenant-context path are proven on an isolated Neon branch.

`db/migrations/` remains the active migration source of truth. A merged SQL file alone is not evidence that a Production migration ran.

## Operations notes

Vercel Production and Preview state are independently readable through the connected Vercel tooling.

A Production runtime warning observed on 2026-08-18 concerns PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.

## Current priorities

1. Keep issue #548 synchronized with the live worker/PR state and current `main` baseline.
2. Keep this file synchronized only when a PR changes stable project-level truth; do not use it for fast-moving task/SHA/deployment state.
3. Activate authenticated Workspace/Booking browser checks only after isolated Preview test infrastructure is proven.
4. Expand state-changing Booking and Quote E2E only after Preview database/auth/email/payment isolation is verified.
5. Continue database tenant-defense work only through isolated-branch proof before any Production RLS rollout.

## Status-document rule

Do not create another competing current-status file.

Historical phase plans and handoffs may remain in `docs/` for context, but they are not current truth unless a canonical source explicitly points to them. Git history is the archive for older versions of this file.
