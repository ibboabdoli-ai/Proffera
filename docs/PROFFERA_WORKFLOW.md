# Proffera Completion Workflow

This document defines **how Proffera is completed from the current product state to a production-ready launch**.

It does **not** replace `AGENTS.md`.

- `AGENTS.md` = mandatory rules for how workers investigate, change, validate, and report work.
- `WORKER_BOOTSTRAP.md` = mandatory startup, installed-toolchain, baseline, and handoff contract for workers.
- `docs/PROFFERA_WORKFLOW.md` = the ordered product-completion plan and release gates.
- `docs/CURRENT_STATUS.md` = a dated status snapshot only; live state must still be verified.
- `.codex/skills/graphify/SKILL.md` = Graphify usage guidance for code architecture and dependency analysis.

Do not duplicate live counts, deployment status, or other fast-changing production facts in this document.

---

## 1. Operating rule

Complete **one primary product journey at a time**.

Do not start a new primary feature path while the current path is still unproven.

Exceptions are allowed for:

- production incidents;
- security issues;
- data-integrity issues;
- explicitly authorized urgent work.

For every implementation task, follow `AGENTS.md` and the mandatory toolchain check in `WORKER_BOOTSTRAP.md`.

The usual loop is:

**Verify reality -> map dependencies -> find root cause -> smallest safe patch -> targeted tests -> preview/staging proof -> PR/CI -> authorized merge/deploy -> production verification**

Graphify is a code-intelligence aid, not a source of truth for production state.

---

## 2. Environment model

### Production

Production is for real users and real business data.

Do not use Production as the first place to test uncertain Booking, Quote, Billing, Auth, migration, or destructive behavior.

### Preview / Staging

Preview/Staging is the proving ground for complete customer journeys.

It should use isolated test resources where required, including:

- dedicated test Workspace/company;
- dedicated test customer/user accounts;
- non-production database or isolated database branch;
- Stripe Test Mode / Sandbox;
- test email delivery or safe test recipients;
- test Booking and Quote data;
- no fallback to Production secrets or Production database state.

A Preview deployment is not automatically a valid staging environment. The worker must verify isolation before using it for destructive or state-changing E2E tests.

---

## 3. Engineering toolchain policy

The repository already has an active engineering toolchain. Workers must use the existing tool for the job before proposing overlapping replacements. Exact worker usage rules live in `WORKER_BOOTSTRAP.md`.

| Priority | Tool | Current decision | Purpose |
| --- | --- | --- | --- |
| 1 | **Graphify 0.9.42** | Active / use now | Understand architecture, dependencies, call paths, and likely blast radius before cross-node changes. |
| 2 | **ESLint + TypeScript + Vitest + Next build** | Active / use now | Validate code from the nearest relevant checks outward before relying on CI. |
| 3 | **Playwright** | Active / use now | Prove public/browser journeys, bilingual behavior, nearby/location behavior, and approved Preview E2E paths. |
| 4 | **GitHub Actions + CodeQL** | Active / use now | Enforce repository governance/build/test/browser gates; run CodeQL security analysis when the repository control enables it. |
| 5 | **SonarQube** | Configured / opt-in until external project is connected | Add code-quality, maintainability, duplication, and additional static-analysis findings without replacing CodeQL/tests. Initial quality gate is advisory. |
| 6 | **CodeRabbit** | Active / final risk-routed review | Review sensitive/large PRs on the exact final head without consuming reviews on every development commit. |
| 7 | **Dependabot** | Active / weekly | Maintain npm, `e2e/`, and GitHub Actions dependencies through the existing controlled update path. |
| 8 | **Vercel Preview + isolated non-Production DB/Neon** | Active / use for runtime proof | Prove state-changing Auth/Booking/Quote/Marketplace/Billing behavior without using Production as the test environment. |
| Later | **Sentry** | Planned before broad launch | Capture real Production/Preview errors and traces without exposing secrets or unnecessary customer data. |
| Later | **Checkly** | Add after critical journeys are stable | Run recurring synthetic checks against safe, non-destructive production/monitoring paths. |
| Later | **PostHog** | Add when real usage volume justifies it | Measure product funnels and behavior with an approved privacy/data-retention setup. |
| Not now | **Semgrep** | Defer | Avoid overlapping static-analysis maintenance until CodeQL/SonarQube coverage proves insufficient. |
| Not now | **Renovate** | Defer | Dependabot already owns routine dependency maintenance for the current stage. |

### Tool rules

- Do not install tools only because they are popular; each tool must close a verified operational gap.
- For architecture/call-path work, use the Graphify skill and existing graph first when available, then confirm important findings in source/runtime evidence.
- Do not send `.env*`, secrets, tokens, credentials, Production data, or customer PII to Graphify, SonarQube, or other third-party tooling.
- Use the root validation scripts and Playwright before inventing custom one-off test harnesses when the existing stack can prove the behavior.
- Treat GitHub Actions required checks as delivery gates; local success does not replace CI.
- Use SonarQube findings as scoped evidence for touched/reachable code. Do not expand a task into unrelated historical-debt cleanup, and do not claim its quality gate is merge-blocking while the configured workflow keeps `sonar.qualitygate.wait=false`.
- Use CodeRabbit only through the current risk-routed exact-head final-review policy; do not request repeated incremental reviews.
- Let Dependabot handle routine dependency updates; do not add Renovate or unrelated package-upgrade sweeps without a verified need.
- Monitoring/analytics integrations must be reviewed for privacy and PII handling before broad Production use.
- Security/static-analysis scanners complement tests; they do not replace runtime or user-flow verification.
- Planned tools are not installed tools. Confirm repository/runtime evidence before claiming Sentry, Checkly, PostHog, or any other future integration is available.

---

## 4. Completion phases

Each phase has an explicit exit gate. Do not call a phase complete until its gate is proven.

### Phase 0 — Source-of-truth baseline

Verify before major work:

- current `main` SHA;
- open PRs and active branches relevant to the scope;
- GitHub Actions status;
- current Vercel Production/Preview state when relevant;
- Production runtime/log evidence when relevant;
- Production database state when relevant;
- actual public/admin UI behavior when relevant.

Use Graphify when dependency/call-path analysis will materially reduce uncertainty, following the pinned project skill and existing-graph-first rule.

**Exit gate:** the current problem/state is based on evidence, not a handoff or assumption.

---

### Phase 1 — Engineering foundation

Required baseline:

- Graphify integration available for architecture analysis;
- repository CI running lint, typecheck, tests, build, and repository-specific checks;
- Playwright available for browser-level proof;
- CodeQL baseline static security scanning configured;
- SonarQube repository workflow/configuration present, with actual scanning enabled only after the external Sonar project/token variables are safely configured;
- risk-routed final CodeRabbit review available for sensitive/large PRs;
- Dependabot dependency-update policy kept simple and reviewable;
- no direct changes to `main`.

**Exit gate:** every PR has a reliable automated engineering gate before merge and workers know which existing tool owns each validation/review need. SonarQube may remain opt-in until its external project is deliberately connected; that state must be reported accurately rather than called an active scan.

---

### Phase 2 — Safe Preview / Staging

Build or verify a test environment that is operationally separate from Production for state-changing E2E tests.

Prove:

- Preview does not silently use Production database/auth secrets;
- dedicated test tenant/workspace exists;
- dedicated test users/customers exist;
- test emails cannot accidentally target unrelated real customers;
- Stripe uses test/sandbox state;
- Booking/Quote test data is clearly non-production.

**Exit gate:** automated E2E tests can mutate test state without risking real customer or Production data.

---

### Phase 3 — Browser E2E with Playwright

Use the existing Playwright suite after the target environment is safe enough for the browser behavior being tested.

Maintain a small, stable suite around:

1. public site smoke test;
2. Swedish root route and English `/en` route;
3. sign-in / authenticated dashboard smoke test using dedicated test accounts when the isolated Preview boundary permits it;
4. public Booking flow;
5. public Quote/request flow;
6. customer Accept/Reject/Cancel/Reschedule paths as implemented;
7. critical mobile viewport smoke tests.

Do not create fake Production bookings or quotes as part of normal CI. State-changing scenarios must remain behind the approved isolated Preview boundary.

**Exit gate:** the critical browser journeys pass repeatably against the approved environment.

---

### Phase 4 — Company Directory

Complete the Company Directory as a reliable customer acquisition surface.

Prove the complete path:

**Discovery -> official verification -> Official Facts -> category confidence -> safe readiness/publication -> public company page -> claim path**

Required invariants:

- official company facts are never guessed;
- unsafe/uncertain companies remain blocked or in review;
- auto-publication remains fail-closed;
- registered address is not represented as service area;
- public company pages are useful on mobile and available in Swedish + English;
- claim flow cannot bypass ownership/auth safety.

**Exit gate:** a new eligible company can move through the verified path safely, and non-eligible companies fail closed.

---

### Phase 5 — Visitor -> Lead

Prove that a real visitor can:

1. discover a relevant company/service;
2. understand the company/service page;
3. submit a request/lead;
4. receive the expected confirmation;
5. create the correct tenant-owned records without leakage to another Workspace.

**Exit gate:** Visitor -> Lead works end-to-end in Preview/Staging and the relevant Production smoke path is verified after authorized release.

---

### Phase 6 — Business -> Response

Prove that the business can:

1. receive the lead/request;
2. see it in the correct Workspace;
3. respond or create the appropriate offer/booking action;
4. notify the customer correctly;
5. preserve tenant/RBAC boundaries.

**Exit gate:** Business response reaches the correct customer and cannot cross Workspace boundaries.

---

### Phase 7 — Booking and Quote lifecycle

Prove the actual lifecycle rather than isolated screens.

Booking path should cover, where supported:

**Booking -> confirmation -> reschedule/cancel -> reminder -> completion -> follow-up/review**

Quote path should cover, where supported:

**Request -> draft offer -> send -> public customer link -> accept/reject -> downstream job/booking state**

Verify idempotency and duplicate-delivery protections on critical actions.

**Exit gate:** supported Booking and Quote journeys are browser-proven and data state remains consistent.

---

### Phase 8 — Business owner onboarding

Prove the owner journey:

**Signup -> Workspace -> business setup -> theme/site setup -> services/availability -> public page -> first lead/booking -> ongoing management**

Requirements:

- tenant isolation;
- role permissions;
- Swedish + English where public/customer-facing;
- mobile usability;
- no hidden Production-only manual setup required for the normal supported path.

**Exit gate:** a new business owner can reach first value without developer intervention for the supported product path.

---

### Phase 9 — Billing

Prove safely in Stripe Test/Sandbox first:

**Trial -> plan selection -> Checkout -> webhook sync -> entitlement -> Customer Portal -> upgrade/downgrade/cancel -> failure/past-due behavior**

Do not invent price/currency behavior outside configured Stripe Prices.

Do not treat billing as release-ready until webhook/state synchronization is proven.

**Exit gate:** supported billing lifecycle is repeatable in test mode and Production activation is explicitly authorized and smoke-tested.

---

### Phase 10 — Observability, security, and launch hardening

Before broad launch, verify:

- Sentry or equivalent error monitoring is correctly configured before treating it as available;
- sensitive data/PII handling is reviewed;
- CodeQL/security findings are triaged;
- SonarQube findings are triaged when the external Sonar project is enabled, without conflating historical debt with new-code blockers;
- critical E2E flows are green;
- SV + EN public routes are covered;
- mobile smoke tests are green;
- SEO/metadata/legal/privacy surfaces are reviewed;
- runtime logs and alert paths are usable;
- rollback/recovery path is known for risky changes;
- known high-risk database/auth/tenant-isolation work is explicitly tracked and not hidden by a green build or static-analysis score.

**Exit gate:** the team can detect, diagnose, and safely respond to a real failure after launch.

---

### Phase 11 — Controlled launch

Launch in controlled steps rather than assuming all Production traffic is the test.

Preferred sequence:

1. internal/test Workspace;
2. a small number of real businesses;
3. observe errors, support friction, conversion blockers, and data integrity;
4. fix verified blockers through the normal `AGENTS.md` loop;
5. expand rollout only after the previous cohort is healthy.

**Exit gate:** real users can complete the primary journeys with acceptable operational stability.

---

## 5. Definition of Done

### Task Done

A code/config/documentation task may be called done when:

- the requirement/problem is verified;
- affected dependencies are understood far enough for the change;
- the smallest safe change is implemented;
- relevant tests/checks pass;
- CI passes where applicable;
- Preview/Staging or another appropriate non-production verification is complete where applicable;
- remaining risks are explicit;
- no unverified Production claim is made.

A task does **not** require an unauthorized Production deploy in order to be Task Done.

### Release Done

A release-impacting change may be called Release Done only when:

- Task Done criteria are satisfied;
- merge is complete;
- deployment was authorized;
- the intended Production deployment is verified;
- affected Production smoke checks pass;
- monitoring/logs show no newly introduced critical regression;
- rollback/recovery considerations are understood for risky changes.

---

## 6. Worker reporting for workflow phases

When a worker advances a workflow phase, report:

- phase and journey being worked on;
- evidence inspected;
- Graphify/dependency path when used;
- relevant installed tools used or explicitly not applicable;
- SonarQube scan/findings status when applicable (`configured but disabled`, `scan passed`, `findings triaged`, etc.);
- change class and blast radius;
- files/configuration changed;
- tests and E2E checks performed;
- Preview/Staging result;
- PR/CI state;
- Production verification state, if authorized and applicable;
- exact remaining blocker to the phase exit gate.

Do not report a phase as complete while the exit gate is unverified.

---

## 7. Current execution order

Unless a production/security incident requires interruption, use this order:

**Engineering foundation -> Safe Preview/Staging -> Playwright E2E -> Company Directory -> Visitor to Lead -> Business Response -> Booking/Quote lifecycle -> Owner onboarding -> Billing -> Observability/Security -> Controlled Launch**

This order is a default execution sequence, not a substitute for checking the current repository and Production state before each task.
