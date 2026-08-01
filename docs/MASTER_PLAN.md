# Proffera Master Plan — Hybrid SaaS and Service Marketplace

Last updated: 2026-08-02

## Current direction

Proffera is evolving into a controlled hybrid of:

- a Bokadirekt-style booking and provider-discovery platform,
- an Offerta-style quote-request and provider-offer marketplace,
- and Proffera-native CRM, reminders, QR booking, AI chat and automation.

The previous SaaS-only controlled-launch scope is no longer the complete product target. Existing SaaS, booking, CRM, billing and tenant-isolation behavior remains protected while marketplace modules are delivered incrementally.

The authoritative dependency plan is:

- [`GRAPH_ENGINEERING_MARKETPLACE_PLAN.md`](GRAPH_ENGINEERING_MARKETPLACE_PLAN.md)

## Delivery policy

No phase may be marked complete until its verification checks pass. Marketplace work must follow dependency order, use additive migrations, preserve existing production flows and keep every workspace isolated.

## Protected production baseline

The following existing capabilities must remain operational during marketplace development:

- Online booking and QR booking
- Lead handling and customer CRM
- Workspace membership and role checks
- Stripe subscription plumbing
- Booking confirmations and reminders
- Public forms with server validation and rate limiting
- Existing company, quote and matching-related persistence flows
- Separate Service AI Chat integration with tenant isolation

## Product graph phases

| Phase | Graph nodes | Outcome |
| --- | --- | --- |
| A | G0-G1 | Product truth, feature flags, production-grade identity and workspace authorization |
| B | G2-G9 | Bokadirekt core: provider profiles, directory, search, reviews, staff calendar, lifecycle and payments |
| C | G10-G15 | Offerta core: provider onboarding, quote requests, matching, offers, comparison, award and messaging |
| D | G16-G18 | Notifications, analytics, AI and auditable business automation |

## Immediate implementation order

1. Add marketplace feature flags and update module claims.
2. Complete production workspace/auth boundary before broad marketplace writes.
3. Implement verified reviews and moderation.
4. Implement public provider profiles, directory and search.
5. Implement multi-staff availability and conflict-safe booking.
6. Implement quote request, matching, offer and award MVP.
7. Add deposits, waiting list, analytics and controlled AI automation.

## Release gates

### Gate 0 — Baseline

- Existing test, lint, typecheck and build checks pass.
- Production rollback point is documented.
- New marketplace flags default to disabled.

### Gate 1 — Isolation

- No authenticated user can read or mutate another workspace's private records.
- Public routes expose only explicitly public provider fields.
- Role-matrix tests pass.

### Gate 2 — Bokadirekt core

- Provider/service discovery works with deterministic filters.
- Reviews require verified eligibility.
- Multi-staff bookings remain conflict-safe.
- Payment and cancellation rules are auditable.

### Gate 3 — Offerta core

- Quote intake stores a consented immutable request snapshot.
- Matching decisions are explainable and stored.
- Offers have revision history.
- Awarding one offer is transactional and creates the downstream CRM/job state exactly once.

### Gate 4 — Intelligence

- Notifications are idempotent.
- Analytics use defined event semantics.
- AI remains tenant-safe, draft-first and kill-switch controlled.

## Non-negotiable safety rules

- No cross-workspace data access.
- No public mutation without validation, abuse controls and audit fields.
- No autonomous AI customer communication before draft-only verification.
- No paid ranking without explicit disclosure and deterministic organic ranking.
- No production payment or customer-data test without explicit approval.
- No node is complete without schema, domain logic, API, UI, tests, telemetry and documentation.

## Definition of complete product target

Proffera reaches the intended target when it supports the core customer journeys of both reference products:

1. A customer discovers a provider, compares trust signals, books an available service, manages the booking and leaves a verified review.
2. A customer submits a structured service request, matched providers submit offers, the customer compares and awards one offer, and the result enters the provider CRM/workflow.
3. The business manages customers, staff, leads, booking, messaging, reminders, payments and reporting within its isolated workspace.
4. AI and automation assist these flows without bypassing consent, authorization, auditability or human control.
