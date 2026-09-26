# Proffera Current Status

Last updated: 2026-09-15

This is the canonical factual status document for Proffera. For worker rules, live task state, current `main` SHA, roadmap order, and the stable V1 completion evidence requirements, also read `AGENTS.md`, `WORKER_BOOTSTRAP.md`, GitHub issue #548, GitHub issue #276, `docs/README.md`, and `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json`.

## Release baseline

- Repository: `ibboabdoli-ai/Proffera`
- Default branch: `main`
- Vercel project: `proffera-jhap`
- Runtime: Next.js on Node.js 22.x

Do not pin the current `main` SHA or current Vercel deployment ID in this file: those values change on every merge and would make the canonical status stale immediately. GitHub issue #548 is the live control board for the current baseline. A source merge is not proof of a live release; Production claims require the matching Vercel Production deployment and affected runtime behavior to be verified.

## Current product state

The repository contains active production implementations for these major areas:

- Better Auth sign-in/session handling and Workspace membership/RBAC.
- Runtime observability uses privacy-minimized structured error events, per-request correlation IDs for proxied application traffic, Next request-error instrumentation, and a same-origin client global-error endpoint with bounded streamed request bodies. Sentry's Next.js SDK runs alongside those existing paths in the browser, Node.js, and Edge runtimes with `sendDefaultPii: false`, conservative tracing, and additional request/breadcrumb scrubbing; Session Replay, Profiling, Sentry Logs, and automatic cron monitors remain disabled. Raw client error messages, stacks, query strings, URL fragments, request headers/bodies, and tokenized raw server request paths are intentionally excluded from the existing sinks and Sentry delivery.
- Better Auth password recovery uses the built-in single-use reset-token flow with a 60-minute expiry, revokes prior sessions after a successful reset, applies dedicated request/reset endpoint rate limits, and exposes bilingual Swedish/English recovery UI. Password-reset email delivery reuses the existing Brevo runtime/Preview isolation boundary. Reset tokens are placed in the browser URL fragment rather than the request path/query, are scrubbed from the address bar before submission, and are not projected into PostHog pageview data. Source/CI proof is not a claim that outbound reset email has been exercised in Production; Preview/Production runtime proof remains governed by the V1 evidence contract and environment approval gates.
- Workspace-scoped Dashboard data for customers, bookings, leads, offers, reviews, billing and service work.
- Public Booking, availability, email verification, booking management and customer portal foundations.
- Quote Request / Offer flows and Service Job lifecycle foundations.
- Verified Review invitation, token, moderation and publication protections.
- Stripe Checkout, Customer Portal, subscription webhook synchronization and billing-alert foundations.
- Canonical Proffera launch subscription pricing is **Starter 299 SEK/month** and **Professional 599 SEK/month**. Application pricing labels derive from the shared billing-plan source; Stripe Price IDs remain environment/provider configuration and must be staged so public copy and Checkout amounts change together. Historical Price objects and existing subscriptions are not migrated or removed without a separate decision.
- Company Directory ingestion, official-facts verification, SNI/category mapping, publication safety gates and admin review flows.
- Public marketplace/search foundations and provider marketplace activation.
- Shared-domain routing is host-aware at the proxy boundary: Proffera/platform hosts reject PrimeView-only public namespaces, PrimeView exposes only its bespoke public namespace plus shared customer lifecycle links, and generic customer domains fail closed outside their root, clean service URLs and shared customer lifecycle routes. PrimeView `/` and `/booking` rewrites plus generic custom-domain root/service rewrites remain the intended public entry points.
- Marketplace geo coverage now uses one explicit coverage-state contract: `confirmed_inside`, `confirmed_outside`, `inferred_nearby`, `locality_fallback`, or `unknown`. Only `confirmed_inside` is eligible for automatic Marketplace outreach. Confirmed service-specific radius wins over confirmed default/profile radius; explicit `confirmed_outside` is terminal; malformed/missing authority fails closed. `workspace_services.service_area` remains metadata rather than geometry, and exact customer coordinates remain private matching data.
- Unclaimed/guest providers continue to use the canonical verified SCB workplace point. A claimed Workspace provider may instead use one unique owner-scoped `service_base` as its internal matching origin only when it is active, explicitly confirmed, exact-address verified by the Lantmäteriet pipeline, and still owned by the same claimed Workspace; missing, ambiguous, invalid, or wrong-Workspace evidence falls back to the canonical SCB point. Exact service-base coordinates are server-internal and are not projected into Marketplace suggestion output.
- Confirmed owner `service_base` writes authorize the claimed Workspace/profile before any external verification call and do not trust caller-supplied coordinates or geocode metadata. Proffera verifies the address through the existing exact Lantmäteriet path, transforms verified SWEREF 99 TM coordinates to WGS84 server-side, and fails closed on no-match/unavailable/invalid output. An unchanged already-exact server-owned service base may reuse its verified coordinates without another provider call; unconfirmed service bases carry no coordinate authority.
- Marketplace Quote Request has a bounded server-side Lantmäteriet exact-address verification path after public-form abuse protection. When the address integration is configured and migration 0059 storage exists, the official object reference and transformed WGS84 coordinates are stored as private matching data separate from browser geolocation; matching prefers verified coordinates without projecting the exact address, coordinates or official reference into the provider Guest Quote view. Definitive official no-match is rejected, configured transient upstream failure is retryable/fail-closed, and missing integration configuration preserves the pre-verification address flow. A source merge or Preview proof is not evidence that this path is active in Production; Production activation still requires the controlled migration/configuration/deployment checks.
- Official-source compliance is explicitly codified for SCB, Lantmäteriet and Bolagsverket. Lantmäteriet-derived public geodata is attributed conditionally as `Lantmäteriet – Belägenhetsadress Direkt` with Proffera own-processing wording when transformed, while exact customer address/reference/coordinates remain private matching data. The Bolagsverket Company Directory adapter rejects non-HTTPS token/source/detail URLs and embedded URL credentials, applies conservative provider-aware process-local request spacing, and allows automated detail lookup only for a known Swedish juridical person or an `unknown` pre-classification discovery seed with a valid company-shaped organisationsnummer; known sole traders and personnummer-shaped identities remain blocked, and broader person-linked data remains outside the automated public Directory path.
- Company Directory direct-contact visibility is a separate server-side entitlement boundary: Unclaimed and Claimed Free directory projections do not expose direct street address/phone/email/website data by default; a claimed Workspace needs valid plan access before direct contact fields may be projected publicly. Internal Official Facts or SCB enrichment does not itself authorize public contact disclosure.
- Marketplace-invited unclaimed companies use a profile-first conversion path: the invitation can open the company’s existing public Directory profile, and the company verifies that same profile rather than creating a duplicate business identity. Normal claims remain manual-review by default. Automatic Workspace provisioning is allowed only for the narrow Marketplace proof case where a recent invitation was successfully sent to the exact business-domain mailbox that owns the signed-in account, that mailbox still matches the profile’s current conflict-free SCB email, and the business-email challenge succeeds; otherwise the claim stays on the existing manual-review path. Opt-out continues to stop future guest outreach but does not revoke the company’s ability to verify ownership of its existing profile. The resulting Workspace is linked back to the same Directory profile, and the source Marketplace invitation/offer is linked to that Workspace without unlocking customer contact data unless the offer wins.
- Company Directory super-admins have a dedicated full-underlag explorer for profile data, Official Facts, SCB contact/postal/workplace data, conflicts, freshness, services, geographic locations and field-source provenance. This internal visibility does not change public contact entitlements.

Proffera V1 completion is governed by the stable machine-readable `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json`. The contract defines 18 launch criteria across Customer/Marketplace, Provider, and Platform Quality, plus the evidence kinds required for each criterion. It is not a live completion report and cannot itself mark a criterion complete. Source merges, green builds, historical screenshots, stale issue text, or unchecked boxes are insufficient when the contract requires Preview/Staging runtime proof, fresh read-only Production evidence, exact deployed-SHA Production runtime evidence, or explicit human approval for a restricted real-world action.

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
6. `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json` — stable machine-readable V1 completion evidence contract; never a live completion report.
7. `docs/README.md` — documentation authority map.
8. `.github/copilot-instructions.md` — automatic GitHub/Copilot agent entry instructions pointing to the same canonical sources.

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
- actual merge eligibility requires an owner-controlled `ibbo-approved` label plus an unedited repository-owner approval comment bound to the exact current head; a human `APPROVED` review does not replace that exact-head owner comment. The standing merge policy committed on `main` is advisory routing/scope context only and never independently authorizes a merge; current-head CI/review/head-SHA gates and blocked sensitive paths remain mandatory.

A repository-owned release rollback runbook and read-only dry-run validator now require an exact known-good Vercel deployment/SHA, explicit database-impact classification, and exact-SHA post-rollback health verification. The standard path never performs a database down-migration automatically; destructive or unknown database impact is blocked pending a separate approved recovery plan.

Production release health is bound to the exact merged `main` commit rather than to a generic scheduled probe. GitHub-token merges do not reliably generate downstream `push` workflow runs, so gated automerge emits a `repository_dispatch` event only after a successful merge and includes the resolved merge commit SHA. The Production health workflow rejects a dispatch whose SHA is missing, malformed or no longer equals the default-branch head, waits for the matching Vercel deployment, and requires that deployed SHA plus schema health to pass. The trusted PR-base gate accepts successful exact-base health evidence from either a normal `push` run or this repository-dispatch handoff; scheduled health remains supplemental rather than proof for a specific PR base.

A dedicated `Worker supervisor sync` GitHub Actions workflow records `work/proffera-*` PR lifecycle events to issue #548 when PRs are opened/reopened, marked ready for review, or closed/merged. This gives the Supervisor a durable automatic event trail independent of private chat memory.

A bounded Phase-1 Supervisor-to-Worker handoff is repository-owned and disabled by default. An owner-authored Task Packet on issue #548 can dispatch at most one implementation Worker through the repository's existing pinned Codex action only when the `worker-dispatch-enabled` kill-switch label is present, the packet is bound to the exact current `main`, graph/file ownership is unambiguous, no active Worker or Dependabot scope overlaps, and required execution credentials already exist. The dispatcher hard-blocks workflow/control-plane authorization, environment/secret, migration/schema, package/lockfile and merge-authority paths; it validates the resulting diff before publication, never supplies merge/approval authority, and records one stable task-state comment keyed by task ID. `worker-supervisor-sync.yml` reconciles trusted Phase-1 Worker PR lifecycle and exact-head CI/CodeQL/Targeted-CI/Production-base-health evidence back into that stable #548 task state, while existing CI, CodeRabbit/Codex review policy, Final Gate and fresh human merge authorization remain authoritative. The detailed contract and recovery behavior are documented in `docs/SUPERVISOR_WORKER_HANDOFF.md`.

CodeRabbit is opt-in rather than automatic on every PR. Review-label reset and post-Validate routing are serialized inside the required CI workflow under pull-request-scoped concurrency. Every fresh PR revision first removes stale `needs-ai-review`; after `Validate` succeeds, a metadata-only job reapplies it and requests one exact-head review whenever a non-draft PR still matches the sensitive/large risk predicate. Non-sensitive PRs do not consume an automatic CodeRabbit review.

Targeted CI uses a trusted-base scope planner for pull requests. The required CI workflow reads changed paths, including both sides of renames, but executes the planner from the PR base rather than from untrusted PR code. Policy version 2 allows bounded low-risk lane reduction while preserving the required `Validate` and `E2E public smoke` status names. Documentation-only changes keep governance and whitespace validation; unit-test-only changes keep lint, typecheck and unit tests; E2E-test-only changes keep lint, typecheck and browser smoke; normal application/source changes still keep lint, typecheck, unit, build and browser lanes. Discovery-worker control/test paths, workflows, APIs, auth/RBAC, tenant/workspace, database/migrations, payments, privacy/Directory, package/lock/configuration paths, unknown paths and other restricted scope remain full-CI. Pushes to `main` always run full CI. A stale event, changed-file read failure, missing planner, unsupported planner schema or planner failure defaults to full CI rather than skipping work. The separate `Targeted CI shadow` workflow remains an advisory mirror of the same trusted-base classification and cannot authorize merge.

The required `E2E public smoke` check is fail-closed for routed PRs. The browser smoke itself runs in an unprivileged Playwright job when the trusted scope requires that lane; the job remains present and succeeds with an explicit targeted-skip record when browser execution is not required. The metadata-only final gate preserves the existing required status name and exact-current-head review rules. Sensitive/high-risk CodeRabbit-only paths evaluate the available current-head review state once and fail closed immediately when review evidence is missing or blocking instead of holding a runner in a ten-minute polling loop. A dedicated `Proffera final gate wakeup` workflow listens only for relevant CodeRabbit/Codex review evidence (plus manual recovery), verifies the PR is still on the same exact head, requires successful `Validate`, `AI review route`, and actual `E2E public smoke run`, then re-runs only the failed/cancelled `E2E public smoke` final job. Heavy lint/test/build/browser jobs are not re-run just because review evidence arrived. Medium-risk non-sensitive fallback keeps its bounded availability window because timeout itself is part of the fallback policy. Accepted non-blocking evidence is either a current-head `COMMENTED`/`APPROVED` submitted review or CodeRabbit's bot-authored recent-review summary for the exact full head SHA stating that no actionable comments were generated. A current-head `CHANGES_REQUESTED` remains blocking even if CodeRabbit later submits a `COMMENTED` review or emits a clean summary; only a later current-head `APPROVED` review clears that change request. Missing/stale review state, stale routing, or a stale workflow head prevents the required check from succeeding. A new commit invalidates previous review evidence because all decisions are matched to the current head SHA.

Gated automerge continues to apply its authorization, sensitive-path, status-check and immediate pre-merge current-head review guards as defense in depth. The final required `E2E public smoke` check remains the delivery-level browser-plus-review gate; the wakeup workflow only re-evaluates that existing gate and never merges. A standing policy is read only from `main`, is constrained by repository owner, phase scope, Supervisor issue, explicit branch prefixes and expiry, and is advisory only; it cannot replace the owner-controlled `ibbo-approved` label plus the unedited exact-head owner approval comment required for actual merge eligibility. Same-repository owner origin and current-head gates remain fail-closed. The policy/workflow files themselves are blocked from gated automerge. Status-check reads remain bounded and fail closed. Highly sensitive paths that were already blocked from automerge remain blocked and require the normal controlled merge path after required checks pass.

For medium-risk non-sensitive PRs, a machine-observed CodeRabbit availability failure or bounded availability timeout may activate the exact-head Codex fallback; Codex cannot override a current-head CodeRabbit `CHANGES_REQUESTED`. Sensitive/high-risk paths remain CodeRabbit-only and intentionally stay blocked if the required CodeRabbit decision is unavailable.

Dependency-bot branches are handled separately by automation and are exempt from Worker Bootstrap declarations and automatic AI-review routing.

## CI and browser testing

`Validate` remains a required stable status and aggregates governance, fail-closed scope resolution, and the scope-selected quality jobs. The trusted-base planner may reduce expensive work only for mapped low-risk pull requests; restricted, sensitive, unknown or unreadable scope remains full-CI.

Available CI lanes cover:

- Worker Bootstrap / branch / documentation governance checks;
- dependency install when a selected Node lane needs it;
- ESLint;
- TypeScript typecheck;
- Vitest/test suite;
- Company Directory discovery-worker Python validation;
- Next.js production build;
- whitespace validation;
- Playwright browser smoke.

Playwright browser E2E is automated in CI. The actual browser job is `E2E public smoke run`; the required `E2E public smoke` check is the final browser-plus-review gate described above. For low-risk scope where browser execution is not selected, the browser job records an explicit targeted skip and the final required gate still runs. No required status name is removed by targeted CI.

Committed non-destructive browser coverage includes:

- public marketing/marketplace smoke coverage;
- public nearby/geolocation coverage;
- the real Login page entry surface;
- bilingual password-recovery page rendering plus client-side reset-token fragment scrubbing without sending reset email;
- Quote intake through service selection and adaptive-details navigation without submitting a request.

An opt-in isolated Preview harness also exists for:

- two-account Workspace visibility/isolation smoke checks;
- read-only rendering of a dedicated published Booking page.

On 2026-08-21 the dedicated non-Production Neon Preview branch was refreshed in place to the current Marketplace/SCB schema and sanitized so tenant/auth/customer/company/quote/payment/review/admin data are empty while only non-sensitive reference catalogs remain. Preview database URL resolution is fail-closed and additionally rejects a Preview URL that resolves to the same database target as a shared database URL. Runtime validation then proved the active Vercel Preview was using the isolated branch, Better Auth could create/sign in a disposable Preview-only account and issue a session cookie, and Stripe resolved dedicated test-mode webhook/price configuration. The disposable auth rows were removed after the check.

Marketplace Guest Quote state transitions were also exercised with synthetic Preview-only data and no external email egress: the real guest page rendered with contact redaction, invitation state changed `sent -> viewed -> responded`, a fixed-price synthetic offer was recorded as `submitted`, the Quote moved to `answered`, and the real success page rendered the saved price/date. All synthetic profile/quote/invitation/offer rows were deleted after the test. The Guest Quote email sender was hardened so Preview now uses the dedicated Brevo resolver and controlled-recipient rewrite instead of directly using shared credentials or the company recipient.

Later isolated Preview evidence supersedes that August blocker. The dedicated Preview lane has successfully exercised controlled Brevo email egress and the full synthetic Marketplace lifecycle through Quote → Matching/Invitation → Provider Offer → Customer Selection → ServiceJob → Completed → Verified Review, with scoped cleanup and no Production mutation. Separate isolated Preview runs also proved Better Auth signup/login/logout/re-login and end-to-end password reset through a fresh controlled Preview email. These runtime results show the Preview Brevo and Auth configuration are operational; do not treat a missing Brevo key or unusable Preview Auth configuration as a current blocker unless fresh runtime evidence contradicts this. Secret values and rotation history remain intentionally opaque and must stay independent from Production.

Other opt-in authenticated/Booking checks may still skip unless their dedicated Preview E2E credentials, Workspace names or booking slug are supplied. They must not become required CI unless the specific flow is proven safe inside the isolated Preview boundary.

Still intentionally excluded from general recurring state-changing browser automation unless separately proven and gated:

- Booking → email verification → confirmation;
- broader Stripe/payment lifecycle;
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

Automatic recurring Production scheduling for Operations, Marketplace Auto Worker, and periodic Production Health is owned by the external QStash scheduler. Operations and Marketplace currently run with cron `8,23,38,53 * * * *`; periodic Production Health runs with `8,38 * * * *`. Their GitHub workflows retain manual or event-driven recovery/release paths but no recurring `schedule:` trigger. Dedicated full Company Directory revalidation is externally scheduled by QStash; live Production run history on 2026-09-06 showed the effective cadence at minutes 13 and 43. The Neon cost-reset cutover contract is documented in `docs/NEON_COST_RESET_CUTOVER.md`; those external QStash changes are not performed by the repository PR.

Operations keeps its existing outer scheduler authorization and canonical Production-origin checks, but runs Booking Reminders, Company Directory Official Facts (limit 10), and Company Directory Sync in-process through their existing authenticated cron handlers instead of issuing HTTP requests back to Production. The child cron endpoints remain independently authenticated and callable. The cost-reset plan keeps Directory Sync at four runs/hour while backlog is material, but proposes splitting the other children to evidence-based lower cadences during a separately authorized external QStash cutover.

Marketplace invitation automation has a bounded first-Production-rollout configuration. The external QStash scheduler currently calls the authenticated Production Marketplace worker every 15 minutes using the existing scheduler bearer credential; the server route still requires both general enablement and the separate Production authorization gate. Production additionally fails closed unless a valid rollout cutoff is configured. The initial cutoff is `2026-08-23T09:24:45.000Z`, so older Quote Request backlog is excluded without modifying or cancelling those rows, and the initial worker batch is limited to one Quote Request per run. Wave 2 retains the six-hour delay. New genuinely persisted Quote Requests also use a targeted event-driven worker kick, while duplicate submissions do not create duplicate event work. The cost-reset contract therefore treats the recurring Marketplace path as recovery fallback but retains its existing `8,23,38,53 * * * *` cadence while `MARKETPLACE_AUTO_WORKER_BATCH_SIZE=1`; the scheduler interval is not a per-request maximum recovery-time guarantee.

Company Directory discovery uses a six-hour lightweight probe of the official SCB/Bolagsverket source, nominally aligned to minute 8 to reduce distinct Neon wake windows. A full bulk scan runs when the upstream `Last-Modified` value is newer than the latest completed discovery snapshot, once daily as a safety fallback at `31 3 * * *`, on manual dispatch, and after discovery automation/worker/ingest changes reach `main`. GitHub scheduled workflows are best-effort and can be delayed, so the six-hour reduction is the primary cost control rather than exact minute alignment. Stockholm and Södertälje remain always-on discovery locations. Outside those locations, eligible companies are admitted through a deterministic 20-bucket nationwide rollout, one bucket per UTC day, so the eligible Swedish coverage accumulates across roughly 20 daily buckets without flooding the verification queue in one run. The discovery SNI scope includes the canonical Directory mappings, including 96.210 for `frisor`. Queue and profile processing remain separate on the QStash-driven Operations path.

Dedicated Company Directory full revalidation is currently requested twice per hour by the external QStash scheduler; live Production run history on 2026-09-06 showed starts at minutes 13 and 43. The GitHub Actions revalidation workflow is retained as a manual `workflow_dispatch` fallback only, and the Operations path does not invoke full revalidation; it keeps the small published-profile safety revalidation separately. Each external wake performs one bounded ten-profile API batch. Read-only audit evidence showed these full-revalidation runs remain productive, so the cost-reset plan preserves the two-per-hour throughput and proposes moving them to minutes 12 and 42 only to cluster DB wake windows. SCB transport keeps the existing 1.05-second request spacing and retries only once for transient network resets/timeouts and retryable HTTP statuses (408/425/429/500/502/503/504), with backoff; permanent response/schema errors still fail closed without repeated requests.

SCB location semantics distinguish the company-level registered seat from the physical workplace. SCB enrichment may retain the company-level municipality as source data, but a Directory profile/public geographic municipality is projected only from the same unambiguous workplace visiting address selected by the public-address resolver. Existing non-SCB/manual values are preserved, while values created by the earlier company-level SCB municipality projection are repairable only when field provenance still owns the current value. Public Directory Search likewise prefers a complete, conflict-free single workplace visiting address for unclaimed profiles so street/postcode/city/municipality stay coherent; claimed Workspace-owned profiles are not overwritten by that projection. The `0058` migration is designed to add the relational `frisor` mapping for primary SNI 96.210 and backfill SNI-owned profile/service relations; that migration behavior was validated only on an isolated Neon branch, and Production execution is not claimed here. Neither repair changes publication status. Geographic coordinates remain a separate controlled Lantmäteriet geocoding path; absence of a verified coordinate is not treated as an SCB-sync failure and broad Production geocoding must not be run without its separate restricted-action approval.

A Production runtime warning observed on 2026-08-18 concerns PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.

## Current priorities

1. Use `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json` to audit all 18 V1 exit criteria against fresh `main`, Preview/runtime evidence and fresh read-only Production evidence; classify gaps rather than assuming completion from source code.
2. Keep issue #548 as the live worker/PR state and current `main` baseline; use automatic Supervisor lifecycle events as the durable event trail.
3. Keep this file synchronized only when a PR changes stable project-level truth; do not use it for fast-moving task/SHA/deployment state.
4. Keep AI-review routing fail closed while avoiding review latency as CI runner latency: low-risk PRs avoid unnecessary review, sensitive/high-risk paths fail fast while waiting for CodeRabbit and wake only the final gate when exact-head review evidence changes, and medium-risk non-sensitive PRs may use bounded Codex fallback only after CodeRabbit availability failure.
5. Audit Directory/scheduler/Neon reliability, PostHog funnel coverage, and Marketplace product gaps from fresh evidence before opening additional implementation PRs.
6. Preserve the proven Preview Brevo/Auth isolation contract; do not rotate or rewrite Preview secrets merely because older documentation called them blockers. Re-run the bounded isolated Preview evidence lane when auth/email behavior changes, and treat any secret rotation as a separate owner-approved security action.
7. Keep recurring state-changing Booking/Stripe and destructive Admin browser automation separately gated; the proven Marketplace lifecycle remains confined to the isolated Preview evidence lane rather than becoming a general Production-like CI mutation path.
8. Continue database tenant-defense work only through isolated-branch proof before any Production RLS rollout.

## Status-document rule

Do not create another competing current-status file.

Historical phase plans and handoffs may remain in `docs/` for context, but they are not current truth unless a canonical source explicitly points to them. Git history is the archive for older versions of the canonical files.
