# Proffera Current Status

Last updated: 2026-08-18

This is the canonical factual status document for Proffera. For worker rules, live task state, and roadmap order, also read `AGENTS.md`, GitHub issue #548, GitHub issue #276, and `docs/README.md`.

## Verified release baseline

- Repository: `ibboabdoli-ai/Proffera`
- Default branch: `main`
- Verified `main` SHA at this update: `2f4e648054eb2f1b32decdaf166bc6869d095abd`
- Vercel project: `proffera-jhap`
- Runtime: Next.js on Node.js 22.x
- Matching Vercel Production deployment: `dpl_FU2pST67G8G6bjtUffDMGLJqT4HT`
- Matching Production deployment state: `READY`

A source merge is not proof of a live release. Production claims require the matching Vercel Production deployment and affected runtime behavior to be verified.

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

Recent production changes verified through matching `main` deployments include:

- #599 — connect existing providers to the marketplace.
- #601 — prevent new Company Directory profiles from starving behind the existing refresh backlog and prioritize unprofiled companies.
- #602 — fix the Booking reminder Workspace UUID join and cover it with regression tests.

## Delivery and AI-control system

Current control plane:

1. `AGENTS.md` — mandatory Graph Engineering worker protocol.
2. GitHub issue #548 — live AI Supervisor control board.
3. GitHub issue #276 — execution roadmap/dependency order.
4. `docs/CURRENT_STATUS.md` — current factual project status.

Current merge-safety baseline recorded by the Supervisor board:

- pull request required before merge;
- branch must be current before merge;
- required `Validate` check;
- required `E2E public smoke` check;
- no force push / protected default branch behavior;
- CodeRabbit performs automatic assertive review;
- gated automerge requires explicit human `ibbo-approved` authorization and must not be treated as an AI-controlled approval mechanism.

AI/product work branches must use `work/proffera-*`. Dependency-bot branches are handled separately by automation.

## CI and browser testing

`Validate` currently covers:

- dependency install;
- ESLint;
- TypeScript typecheck;
- Vitest/test suite;
- Company Directory discovery-worker Python validation;
- Next.js production build;
- whitespace validation.

Playwright browser E2E is automated in CI through `E2E public smoke`.

Current committed browser coverage is primarily public/non-destructive:

- public marketing/marketplace smoke coverage;
- public nearby/geolocation coverage.

The main browser-level gaps are authenticated flows. Priority additions are:

1. sign-in/session behavior;
2. two-account Workspace-isolation smoke coverage;
3. Booking lifecycle coverage;
4. Quote Request → Offer lifecycle coverage;
5. Admin/RBAC coverage;
6. Billing sandbox coverage after the safer core flows above.

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

Vercel Production and Preview state are now independently readable through the connected Vercel tooling.

A current Production runtime warning still appears for PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure, and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.

## Current priorities

1. Keep issue #548 synchronized with active worker/PR state.
2. Keep this file synchronized whenever a PR changes project-level truth.
3. Enforce the canonical `work/proffera-*` AI branch convention in required validation.
4. Expand browser E2E from public smoke into authenticated Workspace, Booking and Quote flows using isolated test accounts/environments.
5. Continue database tenant-defense work only through isolated-branch proof before any Production RLS rollout.

## Status-document rule

Do not create another competing current-status file.

Historical phase plans and handoffs may remain in `docs/` for context, but they are not current truth unless a canonical source explicitly points to them. Git history is the archive for older versions of this file.
