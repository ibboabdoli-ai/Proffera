# Proffera Marketplace Graph Engineering Plan

Last updated: 2026-08-02

## Product goal

Evolve Proffera from a standalone SaaS booking/CRM product into a controlled hybrid of:

- Bokadirekt-style discovery, profiles, availability, booking, reviews and payments.
- Offerta-style quote requests, provider matching, offers and comparison.
- Proffera-native AI chat, QR booking, CRM, reminders and business automation.

This is a product-direction change from the previous controlled SaaS-only launch plan. Existing paid SaaS, booking, CRM, billing and tenant-isolation behavior must remain operational while marketplace capabilities are added incrementally.

## Graph engineering rules

1. Model the product as a dependency graph, not a flat feature checklist.
2. Complete prerequisite nodes before dependent nodes.
3. Keep every migration additive and reversible until production verification passes.
4. Enforce workspace and customer isolation at the database and application layers.
5. Put all public writes behind validation, rate limiting, audit fields and abuse controls.
6. Ship each vertical slice with schema, domain service, API, UI, tests, telemetry and documentation.
7. Never mark a node complete until its verification gate passes.

## Dependency graph

```text
G0 Product truth and baseline
├── G1 Identity, workspace and authorization boundary
│   ├── G2 Provider profile and service catalogue
│   │   ├── G3 Public directory and search
│   │   │   ├── G4 Reviews and ratings
│   │   │   └── G5 Marketplace SEO and public provider pages
│   │   └── G6 Staff, resources and availability calendar
│   │       ├── G7 Customer reschedule/cancel
│   │       ├── G8 Waiting list
│   │       └── G9 Deposits and booking payments
│   └── G10 Marketplace roles and provider onboarding
│       └── G11 Quote request intake
│           └── G12 Provider matching
│               └── G13 Offer submission
│                   └── G14 Offer comparison and award
│                       └── G15 Marketplace messaging and audit trail
├── G16 Notification and reminder orchestration
├── G17 Analytics and marketplace reporting
└── G18 AI and business automation
```

## Delivery order

### Phase A — Foundation and product truth

#### G0 — Baseline

- Freeze and document the verified production baseline.
- Inventory existing booking, CRM, leads, reminders, quote/company flows and billing.
- Update public module claims to distinguish active, beta and planned capabilities.
- Add feature flags for directory, reviews, multi-staff, quote marketplace and payments.

Verification:

- Existing tests, lint, typecheck and build pass.
- Existing booking and CRM flows are unchanged.
- Feature flags default to off for new marketplace modules.

#### G1 — Identity and workspace boundary

- Remove remaining assumptions that use a shared/default workspace boundary.
- Require authenticated workspace membership for private data.
- Define roles: platform_admin, workspace_owner, workspace_admin, staff, provider_sales.
- Add explicit authorization helpers for every marketplace mutation.

Verification:

- Cross-workspace reads and writes are denied.
- Public pages expose only explicitly public provider data.
- Role matrix tests pass.

### Phase B — Bokadirekt core

#### G2 — Provider profile and service catalogue

- Public business identity, categories, service areas, languages and contact policy.
- Service duration, price type, fixed/from price, tax display and booking eligibility.
- Media, certifications and opening-hours metadata.

#### G6 — Staff/resources/availability

- Multiple staff per workspace.
- Staff-service assignments.
- Recurring availability, breaks, exceptions and resource conflicts.
- Atomic booking conflict protection.

#### G3 — Directory and search

- Public provider directory.
- Search by service, category, city/area, language, availability and rating.
- Deterministic ranking before paid/promoted ranking is considered.

#### G4 — Reviews and ratings

- Reviews only from eligible completed bookings or awarded quote jobs.
- One review per eligible transaction.
- Moderation status, business response, abuse reporting and audit trail.
- Aggregated rating and review count maintained transactionally or by verified job.

#### G7/G8/G9 — Booking lifecycle expansion

- Self-service reschedule/cancel under workspace policy.
- Waiting list with explicit consent and expiry.
- Stripe deposit/full-payment support with refund/cancellation rules.

### Phase C — Offerta core

#### G10 — Provider onboarding

- Provider marketplace eligibility, service categories and service areas.
- Verification status and matching preferences.

#### G11 — Quote request intake

- Structured request, category-specific fields, files/photos, location and desired timing.
- Consent, privacy version, spam protection and immutable request snapshot.

#### G12 — Matching

- Eligibility filter: category, geography, capacity, status and plan entitlement.
- Explainable score: relevance, distance/area, response history and availability.
- Match snapshot stored for auditability.

#### G13 — Offers

- Provider offer with price model, scope, validity, proposed times and attachments.
- Offer revision history and withdrawal state.

#### G14 — Compare and award

- Customer comparison view.
- Award exactly one active offer with transactional locking.
- Convert awarded offer into customer, job/booking and CRM timeline records.

#### G15 — Messaging

- Request-scoped messaging.
- Contact-data disclosure policy.
- Moderation/audit records and notification orchestration.

### Phase D — Intelligence and growth

#### G16 — Notifications

- Event-driven confirmation, reminder, offer and follow-up notifications.
- Idempotency and delivery audit.

#### G17 — Analytics

- Funnel: discovery -> profile -> request/booking -> completion -> review.
- Provider response rate, win rate, utilisation and revenue.
- Platform marketplace health metrics.

#### G18 — AI and automation

- AI chat as a separate tenant-safe integration first.
- Lead qualification, service recommendation and booking assistance.
- Draft-only provider replies before any autonomous sending.
- Rule-based automation with audit log and kill switch.

## Initial vertical slices

1. Foundation flags and source-of-truth documentation.
2. Verified review eligibility and moderation.
3. Provider public profile plus directory/search.
4. Multi-staff availability and conflict-safe booking.
5. Quote request -> matching -> offer -> award MVP.
6. Deposits, waiting list and expanded lifecycle.
7. Analytics, AI and automation.

## Definition of done for every graph node

- Database migration is additive, reviewed and has rollback guidance.
- Authorization and tenant-isolation tests exist.
- Domain rules are implemented outside UI components.
- API input and output are validated.
- UI supports empty, loading, success and failure states.
- Audit/telemetry events are emitted where required.
- Documentation and release checklist are updated.
- Preview verification passes before production merge.
