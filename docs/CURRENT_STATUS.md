# Proffera Current Status

Last updated: 2026-08-21

This is the canonical factual status document for Proffera. For worker rules, live task state, current `main` SHA, and roadmap order, also read `AGENTS.md`, `WORKER_BOOTSTRAP.md`, GitHub issue #548, GitHub issue #276, and `docs/README.md`.

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
- Company Directory direct-contact visibility is a separate server-side entitlement boundary: Unclaimed and Claimed Free directory projections do not expose direct street address/phone/email/website data by default; a claimed Workspace needs valid plan access before direct contact fields may be projected publicly. Internal Official Facts or SCB enrichment does not itself authorize public contact disclosure.
- Company Directory super-admins have a dedicated full-underlag explorer for profile data, Official Facts, SCB contact/postal/workplace data, conflicts, freshness, services, geographic locations and field-source provenance. This internal visibility does not change public contact entitlements.

Recent Production changes independently verified through matching `main` deployments on 2026-08-18 include:

- #599 — connect existing providers to the marketplace.
- #601 — prevent new Company Directory profiles from starving behind the existing refresh backlog and prioritize unprofiled companies.
- #602 — fix the Booking reminder Workspace UUID join and cover it with regression tests.
- #603 — centralize project truth and enforce AI branch/documentation governance.
- #605 — expand non-destructive Login/Quote browser smoke and add isolated Preview auth/Booking harnesses.

## Delivery and AI-control system

Current control plane:

1. `AGENTS.md` — mandatory Graph Engineering worker protocol.
2. `WORKER_BOOTSTRAP.md` — mandatory Worker startup, baseline and PR handoff contract.
3. GitHub issue #548 — live AI Supervisor control board, including current `main` baseline and active queue.
4. GitHub issue #276 — execution roadmap/dependency order.
5. `docs/CURRENT_STATUS.md` — stable factual project status.
6. `docs/README.md` — documentation authority map.
7. `.github/copilot-instructions.md` — automatic GitHub/Copilot agent entry instructions pointing to the same canonical sources.

Current merge-safety rules include:

- pull request required before merge;
- AI/product branches must use `work/proffera-*`;
- non-Dependabot PRs must declare a concrete task/issue identity;
- non-Dependabot PRs must declare `Worker bootstrap: complete` and `Supervisor handoff: #548`;
- the declared bootstrap baseline must be a 40-character SHA matching the current PR base SHA;
- PRs must declare exactly one of `Documentation impact: updated` or `Documentation impact: none`;
- `Documentation impact: updated` requires this canonical status file to change in the same PR;
- required `Validate` check;
- required `E2E public smoke` check;
- no force push / protected default branch behavior;
- gated automerge requires a fresh owner-applied `ibbo-approved` authorization after the current head commit and must not be treated as AI self-approval.

A dedicated `Worker supervisor sync` GitHub Actions workflow records `work/proffera-*` PR lifecycle events to issue #548 when PRs are opened/reopened, marked ready for review, or closed/merged. This gives the Supervisor a durable automatic event trail independent of private chat memory.

CodeRabbit is opt-in rather than automatic on every PR. Review-label reset and post-Validate routing are serialized inside the required CI workflow under pull-request-scoped concurrency. Every fresh PR revision first removes stale `needs-ai-review`; after `Validate` succeeds, a metadata-only job reapplies it and requests one exact-head review whenever a non-draft PR still matches the sensitive/large risk predicate. Non-sensitive PRs do not consume an automatic CodeRabbit review.

The required `E2E public smoke` check is fail-closed for routed PRs. The browser smoke itself runs in an unprivileged Playwright job; a separate metadata-only final gate keeps the required check pending until CodeRabbit has produced exact-current-head evidence. Accepted non-blocking evidence is either a current-head `COMMENTED`/`APPROVED` submitted review or CodeRabbit's bot-authored recent-review summary for the exact full head SHA stating that no actionable comments were generated. A current-head `CHANGES_REQUESTED` remains blocking even if CodeRabbit later submits a `COMMENTED` review or emits a clean summary; only a later current-head `APPROVED` review clears that change request. Missing/stale review state, stale routing, or a stale workflow head prevents the required check from succeeding. A new commit invalidates previous review evidence because all decisions are matched to the current head SHA.

Gated automerge independently applies the same risk predicate and current-head CodeRabbit decision rules for paths it is otherwise allowed to merge. It can re-evaluate after CodeRabbit issue-comment updates and after a successful CI workflow completion, so a clean-review/comment race cannot strand an otherwise eligible PR. Status-check reads are bounded by a per-attempt timeout, checks are classified with GitHub CLI buckets, fail/cancel outcomes are rejected, pending outcomes are retried for a bounded window, and unknown outcomes fail closed. Highly sensitive paths that were already blocked from automerge remain blocked and require the normal manual merge path after required checks pass.

If CodeRabbit is rate-limited or otherwise unavailable, a sensitive/large PR intentionally remains blocked instead of silently merging without the required review.

Dependency-bot branches are handled separately by automation and are exempt from Worker Bootstrap declarations and automatic AI-review routing.

## CI and browser testing

`Validate` covers:

- Worker Bootstrap / branch / documentation governance checks;
- dependency install;
- ESLint;
- TypeScript typecheck;
- Vitest/test suite;
- Company Directory discovery-worker Python validation;
- Next.js production build;
- whitespace validation.

Playwright browser E2E is automated in CI. The actual browser run is `E2E public smoke run`; the required `E2E public smoke` check is the final browser-plus-review gate described above.

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

Company Directory discovery uses an hourly lightweight probe of the official SCB/Bolagsverket source. A full bulk scan runs when the upstream `Last-Modified` value is newer than the latest completed discovery snapshot, once daily as a safety fallback, on manual dispatch, and after discovery automation/worker/ingest changes reach `main`. Stockholm and Södertälje remain always-on discovery locations. Outside those locations, eligible companies are admitted through a deterministic 20-bucket nationwide rollout, one bucket per UTC day, so the eligible Swedish coverage accumulates across roughly 20 daily buckets without flooding the verification queue in one run. The discovery SNI scope includes the canonical Directory mappings, including 96.210 for `frisor`. Queue and profile processing remain separate on the 15-minute operations workflow.

Dedicated Company Directory full revalidation is requested by a five-minute GitHub Actions schedule. Because scheduled workflow wake-ups can be delayed, each wake drains two sequential bounded ten-profile API batches rather than relying on exact scheduler timing. SCB transport keeps the existing 1.05-second request spacing and retries only once for transient network resets/timeouts and retryable HTTP statuses (408/425/429/5xx), with backoff; permanent response/schema errors still fail closed without repeated requests.

A Production runtime warning observed on 2026-08-18 concerns PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.

## Current priorities

1. Keep issue #548 as the live worker/PR state and current `main` baseline; use automatic Supervisor lifecycle events as the durable event trail.
2. Keep this file synchronized only when a PR changes stable project-level truth; do not use it for fast-moving task/SHA/deployment state.
3. Keep CodeRabbit consumption risk-routed and fail closed: sensitive/large PRs require an acceptable CodeRabbit decision on the current head before the required merge gate can pass.
4. Monitor nationwide Company Directory rollout volume and queue health before increasing rollout speed.
5. Activate authenticated Workspace/Booking browser checks only after isolated Preview test infrastructure is proven.
6. Expand state-changing Booking and Quote E2E only after Preview database/auth/email/payment isolation is verified.
7. Continue database tenant-defense work only through isolated-branch proof before any Production RLS rollout.

## Status-document rule

Do not create another competing current-status file.

Historical phase plans and handoffs may remain in `docs/` for context, but they are not current truth unless a canonical source explicitly points to them. Git history is the archive for older versions of the canonical files.
