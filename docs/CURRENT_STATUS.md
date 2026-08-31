# Proffera Current Status

Last updated: 2026-08-31

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
- Marketplace Quote Request has a bounded server-side Lantmäteriet exact-address verification path after public-form abuse protection. When the address integration is configured and migration 0059 storage exists, the official object reference and transformed WGS84 coordinates are stored as private matching data separate from browser geolocation; matching prefers verified coordinates without projecting the exact address, coordinates or official reference into the provider Guest Quote view. Definitive official no-match is rejected, configured transient upstream failure is retryable/fail-closed, and missing integration configuration preserves the pre-verification address flow. A source merge or Preview proof is not evidence that this path is active in Production; Production activation still requires the controlled migration/configuration/deployment checks.
- Official-source compliance is explicitly codified for SCB, Lantmäteriet and Bolagsverket. Lantmäteriet-derived public geodata is attributed conditionally as `Lantmäteriet – Belägenhetsadress Direkt` with Proffera own-processing wording when transformed, while exact customer address/reference/coordinates remain private matching data. The Bolagsverket Company Directory adapter rejects non-HTTPS token/source/detail URLs and embedded URL credentials, applies conservative provider-aware process-local request spacing, and allows automated detail lookup only for a known Swedish juridical person or an `unknown` pre-classification discovery seed with a valid company-shaped organisationsnummer; known sole traders and personnummer-shaped identities remain blocked, and broader person-linked data remains outside the automated public Directory path.
- Company Directory direct-contact visibility is a separate server-side entitlement boundary: Unclaimed and Claimed Free directory projections do not expose direct street address/phone/email/website data by default; a claimed Workspace needs valid plan access before direct contact fields may be projected publicly. Internal Official Facts or SCB enrichment does not itself authorize public contact disclosure.
- Marketplace-invited unclaimed companies use a profile-first conversion path: the invitation can open the company’s existing public Directory profile, and the company verifies that same profile rather than creating a duplicate business identity. Normal claims remain manual-review by default. Automatic Workspace provisioning is allowed only for the narrow Marketplace proof case where a recent invitation was successfully sent to the exact business-domain mailbox that owns the signed-in account, that mailbox still matches the profile’s current conflict-free SCB email, and the business-email challenge succeeds; otherwise the claim stays on the existing manual-review path. Opt-out continues to stop future guest outreach but does not revoke the company’s ability to verify ownership of its existing profile. The resulting Workspace is linked back to the same Directory profile, and the source Marketplace invitation/offer is linked to that Workspace without unlocking customer contact data unless the offer wins.
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
8. `scripts/ci/classify-pr-risk.mjs` — canonical deterministic PR risk classifier used by CI and, from `main`, by gated automerge.
9. `scripts/ci/review-gate.sh` — canonical exact-head external-review evaluator and provider failover policy.

Current merge-safety rules include:

- pull request required before merge;
- AI/product branches must use `work/proffera-*`;
- non-Dependabot PRs must declare a concrete task/issue identity;
- non-Dependabot PRs must declare `Worker bootstrap: complete` and `Supervisor handoff: #548`;
- the declared bootstrap baseline must be a 40-character SHA matching the current PR base SHA;
- PRs must declare exactly one of `Documentation impact: updated` or `Documentation impact: none`;
- `Documentation impact: updated` requires this canonical status file to change in the same PR;
- required `Validate` check;
- required `E2E public smoke` compatibility final gate;
- no force push / protected default branch behavior;
- gated automerge can use either an owner-applied `ibbo-approved` label backed by a repository-owner `APPROVED` review on the exact current head, or a scoped standing merge authorization committed on `main`; standing authorization is limited to trusted same-repository owner-authored PRs and never removes current-head CI/review/head-SHA gates;
- the canonical risk classifier separates `reviewRisk`, `humanMergeRequired`, `dbTestsRequired`, and `productionImpact` instead of treating every sensitive path as one Boolean. A `humanMergeRequired=true` classification cannot be satisfied by standing authorization and requires fresh exact-head owner authorization.

Production release health is bound to the exact merged `main` commit rather than to a generic scheduled probe. GitHub-token merges do not reliably generate downstream `push` workflow runs, so gated automerge emits a `repository_dispatch` event only after a successful merge and includes the resolved merge commit SHA. The Production health workflow rejects a dispatch whose SHA is missing, malformed or no longer equals the default-branch head, waits for the matching Vercel deployment, and requires that deployed SHA plus schema health to pass. The trusted PR-base gate accepts successful exact-base health evidence from either a normal `push` run or this repository-dispatch handoff; scheduled health remains supplemental rather than proof for a specific PR base.

A dedicated `Worker supervisor sync` GitHub Actions workflow records `work/proffera-*` PR lifecycle events to issue #548 when PRs are opened/reopened, marked ready for review, or closed/merged. This gives the Supervisor a durable automatic event trail independent of private chat memory.

AI review is risk-routed and provider-neutral. Every fresh PR revision removes stale `needs-ai-review`; after `Validate`, the canonical classifier decides whether review is required and the route applies the label only for the exact current head. Codex is the primary reviewer. The gate accepts Codex only when evidence is bound to the current head: exact-head review comments/findings remain blocking, while a current-head approval or a fresh Codex clean reaction created after the current head commit/request can satisfy the review. If Codex is explicitly unavailable or does not produce acceptable evidence within the bounded primary window, the gate requests CodeRabbit as an availability fallback. A current-head CodeRabbit `CHANGES_REQUESTED` remains blocking unless a strictly later current-head CodeRabbit `APPROVED` review clears it.

Provider switching is fail-closed for findings: a clean result from one provider never overrides a current-head finding from the other provider. A new commit invalidates old evidence. If neither Codex nor CodeRabbit produces acceptable exact-head evidence inside the bounded gate window, the PR remains blocked; external-provider unavailability is reported as review availability rather than being misrepresented as a browser failure.

PR-Agent/Gemini is not yet an authoritative merge-pass path. It may be evaluated later as an additional availability adapter, but it must not clear the final gate until the repository has both an approved credential/data boundary and a machine-verifiable clean-versus-finding contract proven on a real non-sensitive PR. No Gemini secret is required by the current delivery path.

The actual browser check is `E2E public smoke run`. `AI review gate` is a separate visible job. The ruleset-required check name `E2E public smoke` is retained as a compatibility final gate so branch protection does not need to change; it requires the browser run, the applicable AI review gate, and the exact-current-head `Analyze JavaScript/TypeScript` CodeQL check to succeed. This prevents a provider outage from being mislabeled as a browser-test failure while preserving the existing required-check contract.

Gated automerge independently fetches the canonical classifier and review evaluator from `main`, not from the PR branch, before making merge decisions. This prevents a PR from self-declassifying by editing the control-plane scripts. It still reads standing authorization only from `main`, rejects standing authorization when `humanMergeRequired=true`, waits for all non-self status checks, rechecks the live head SHA, and merges with `--match-head-commit`. The classifier, review evaluator, workflows, standing authorization, auth/tenant, database/schema, payment, secret, deployment, package/lockfile and other high-risk control paths require the normal fresh-human controlled merge path.

Dependency-bot branches are handled separately by automation and are exempt from Worker Bootstrap declarations and automatic AI-review routing.

## CI and browser testing

`Validate` covers the parallel core quality path:

- Worker Bootstrap / branch / documentation governance checks;
- dependency install;
- ESLint;
- TypeScript typecheck;
- Vitest/test suite;
- Company Directory discovery-worker Python validation;
- Next.js production build;
- whitespace validation.

PR risk classification runs once from the exact PR head and feeds downstream review metadata. PostgreSQL/race tests remain in their existing test execution model for now; the classifier exposes `dbTestsRequired` for later optimization, but this control-plane change does not reduce current database/concurrency coverage.

Playwright browser E2E is automated in CI. The actual browser run is `E2E public smoke run`; `AI review gate` reports external-review status separately; the required `E2E public smoke` compatibility gate combines successful browser E2E, the applicable exact-head AI review result, and exact-head CodeQL without changing the repository ruleset check name.

Committed non-destructive browser coverage includes:

- public marketing/marketplace smoke coverage;
- public nearby/geolocation coverage;
- the real Login page entry surface;
- Quote intake through service selection and adaptive-details navigation without submitting a request.

An opt-in isolated Preview harness also exists for:

- two-account Workspace visibility/isolation smoke checks;
- read-only rendering of a dedicated published Booking page.

On 2026-08-21 the dedicated non-Production Neon Preview branch was refreshed in place to the current Marketplace/SCB schema and sanitized so tenant/auth/customer/company/quote/payment/review/admin data are empty while only non-sensitive reference catalogs remain. Preview database URL resolution is fail-closed and additionally rejects a Preview URL that resolves to the same database target as a shared database URL. Runtime validation then proved the active Vercel Preview was using the isolated branch, Better Auth could create/sign in a disposable Preview-only account and issue a session cookie, and Stripe resolved dedicated test-mode webhook/price configuration. The disposable auth rows were removed after the check.

Marketplace Guest Quote state transitions were also exercised with synthetic Preview-only data and no external email egress: the real guest page rendered with contact redaction, invitation state changed `sent -> viewed -> responded`, a fixed-price synthetic offer was recorded as `submitted`, the Quote moved to `answered`, and the real success page rendered the saved price/date. All synthetic profile/quote/invitation/offer rows were deleted after the test. The Guest Quote email sender was hardened so Preview now uses the dedicated Brevo resolver and controlled-recipient rewrite instead of directly using shared credentials or the company recipient.

The remaining Preview activation blockers are operational: a genuinely independent `PROFFERA_PREVIEW_BREVO_API_KEY` is not yet configured, so Preview outbound email remains intentionally fail-closed; the current Preview Better Auth secret should also be rotated to a strong random value after runtime warnings identified it as weak/short. Full controlled-recipient email egress and the normal Admin-visible end-to-end route must be re-run before recurring state-changing browser automation is enabled.

Those authenticated/Booking checks intentionally skip unless dedicated Preview E2E credentials/workspace names/booking slug are supplied. They must not become required CI until Preview is proven isolated from Production for database, auth, email, payments and customer data.

Still intentionally excluded from recurring state-changing browser automation until the remaining runtime isolation gate is proven:

- Booking → email verification → confirmation;
- full Marketplace Quote invitation → controlled email → Offer → Admin visibility;
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

Automatic recurring Production scheduling for Operations, Marketplace Auto Worker, and periodic Production Health is owned by the external QStash scheduler. Operations and Marketplace run with cron `8,23,38,53 * * * *`; periodic Production Health runs with `8,38 * * * *`. Their GitHub workflows retain manual or event-driven recovery/release paths but no recurring `schedule:` trigger. Company Directory discovery remains GitHub-scheduled, while dedicated full Company Directory revalidation remains externally scheduled by QStash at minutes 14 and 44.

Marketplace invitation automation has a bounded first-Production-rollout configuration. The external QStash scheduler calls the authenticated Production Marketplace worker every 15 minutes using the existing scheduler bearer credential; the server route still requires both general enablement and the separate Production authorization gate. Production additionally fails closed unless a valid rollout cutoff is configured. The initial cutoff is `2026-08-23T09:24:45.000Z`, so older Quote Request backlog is excluded without modifying or cancelling those rows, and the initial worker batch is limited to one Quote Request per run. Wave 2 retains the six-hour delay. A merged configuration is not by itself proof of live sending; the matching Production deployment and runtime worker result must be verified after release.

Company Directory discovery uses an hourly lightweight probe of the official SCB/Bolagsverket source. A full bulk scan runs when the upstream `Last-Modified` value is newer than the latest completed discovery snapshot, once daily as a safety fallback, on manual dispatch, and after discovery automation/worker/ingest changes reach `main`. Stockholm and Södertälje remain always-on discovery locations. Outside those locations, eligible companies are admitted through a deterministic 20-bucket nationwide rollout, one bucket per UTC day, so the eligible Swedish coverage accumulates across roughly 20 daily buckets without flooding the verification queue in one run. The discovery SNI scope includes the canonical Directory mappings, including 96.210 for `frisor`. Queue and profile processing remain separate on the QStash-driven 15-minute Operations path.

Dedicated Company Directory full revalidation is requested twice per hour by the external QStash scheduler at minutes 14 and 44. The GitHub Actions revalidation workflow is retained as a manual `workflow_dispatch` fallback only, and the 15-minute Operations path no longer invokes full revalidation; it keeps the small published-profile safety revalidation separately. Each QStash wake performs one bounded ten-profile API batch. SCB transport keeps the existing 1.05-second request spacing and retries only once for transient network resets/timeouts and retryable HTTP statuses (408/425/429/500/502/503/504), with backoff; permanent response/schema errors still fail closed without repeated requests.

SCB location semantics distinguish the company-level registered seat from the physical workplace. SCB enrichment may retain the company-level municipality as source data, but a Directory profile/public geographic municipality is projected only from the same unambiguous workplace visiting address selected by the public-address resolver. Existing non-SCB/manual values are preserved, while values created by the earlier company-level SCB municipality projection are repairable only when field provenance still owns the current value. Public Directory Search likewise prefers a complete, conflict-free single workplace visiting address for unclaimed profiles so street/postcode/city/municipality stay coherent; claimed Workspace-owned profiles are not overwritten by that projection. The `0058` migration is designed to add the relational `frisor` mapping for primary SNI 96.210 and backfill SNI-owned profile/service relations; that migration behavior was validated only on an isolated Neon branch, and Production execution is not claimed here. Neither repair changes publication status. Geographic coordinates remain a separate controlled Lantmäteriet geocoding pilot; absence of a verified coordinate is not treated as an SCB-sync failure and broad geocoding must not be enabled until the upstream PROD lookup path produces verified references.

A Production runtime warning observed on 2026-08-18 concerns PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.

## Current priorities

1. Keep issue #548 as the live worker/PR state and current `main` baseline; use automatic Supervisor lifecycle events as the durable event trail.
2. Keep this file synchronized only when a PR changes stable project-level truth; do not use it for fast-moving task/SHA/deployment state.
3. Keep AI review provider-neutral and fail closed: use the canonical classifier, prefer Codex, use CodeRabbit only as bounded availability fallback/optional evidence, and never let one provider's clean result override another provider's current-head finding.
4. Monitor nationwide Company Directory rollout volume and queue health before increasing rollout speed.
5. Configure an independent Preview Brevo credential and rotate the weak Preview Better Auth secret, then re-run controlled-recipient email and Admin-visible Marketplace E2E.
6. Keep recurring state-changing Booking/Marketplace/Stripe browser automation gated until the remaining Preview runtime isolation checks are proven.
7. Continue database tenant-defense work only through isolated-branch proof before any Production RLS rollout.

## Status-document rule

Do not create another competing current-status file.

Historical phase plans and handoffs may remain in `docs/` for context, but they are not current truth unless a canonical source explicitly points to them. Git history is the archive for older versions of the canonical files.
