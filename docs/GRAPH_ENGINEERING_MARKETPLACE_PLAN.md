# Proffera Code + Graph Engineering Execution Plan

Last updated: 2026-08-02

## Product strategy

Proffera is first a service-business operating system. Marketplace capabilities are added only after the private workspace product is secure, useful and populated with real providers.

The target combines:

- Proffera core: website, booking, quote inbox, CRM, reminders, QR and automation.
- Bokadirekt-style direct discovery and booking for scheduling-oriented providers.
- Offerta-style multi-provider quote requests after a limited provider network is viable.

Do not copy every competitor feature. Build the smallest shared domain that supports real customer workflows and preserves tenant isolation.

## Final dependency graph

```text
E0 Verified baseline and delivery controls
└── E1 Central authorization and tenant isolation
    └── E2 Provider, service and service-area foundation
        └── E3 Single-business quote inbox
            └── E4 Shared service-job backbone
                ├── E5 Verified reviews
                ├── E6 Optional Booking Pro
                └── E7 Limited public provider network
                    └── E8 Multi-provider quote marketplace pilot
                        ├── E9 Provider payments/deposits
                        └── E10 AI and business automation
```

Cross-cutting dependencies:

```text
Feature flags + validation + rate limits + audit log + notifications + tests
apply to every node.
```

## Engineering protocol

Each node is delivered as a small vertical slice:

1. Read the existing schema and implementation before designing changes.
2. Record current behavior and protected flows.
3. Add an additive migration with rollback guidance when schema changes are needed.
4. Keep authorization and domain logic outside UI components.
5. Validate all API inputs and enforce workspace scope server-side.
6. Add focused tests, including a negative cross-workspace test.
7. Run test, lint, typecheck and build.
8. Verify in Preview with non-production data.
9. Merge one focused PR.
10. Update status and only then unlock the dependent node.

No node is complete based only on UI presence.

## E0 — Verified baseline and delivery controls

### Work

- Inventory routes, APIs, migrations, tables, auth helpers and public-write paths.
- Record the current production commit and rollback point.
- Classify every public module as Active, Beta, Internal or Planned.
- Confirm CI runs tests, lint, typecheck and build.
- Define feature flags for quote inbox, service jobs, reviews, booking pro, directory and marketplace.

### Gate

- Existing booking, CRM, billing and reminders remain unchanged.
- The executable schema is identified from ordered migrations.
- No new marketplace module is publicly enabled.

## E1 — Central authorization and tenant isolation

### Work

- Introduce or consolidate one server-side authorization boundary.
- Resolve the current workspace from authenticated membership, never from client input alone.
- Define the minimum role matrix: platform_admin, workspace_owner, workspace_admin and staff.
- Inventory and progressively remove `default` workspace fallbacks.
- Add cross-workspace read and mutation denial tests.

### Gate

- Workspace A cannot read or mutate private data belonging to Workspace B.
- Public routes expose only explicit public projections.
- Legacy records are backfilled before any fallback is removed.

## E2 — Provider, service and service-area foundation

### Work

- Reuse the workspace as the private provider boundary where possible.
- Add public provider profile data separately from private workspace settings.
- Normalize service catalogue, pricing mode, duration and booking/quote eligibility.
- Add structured service areas and language/country/timezone/currency metadata.

### Gate

- A workspace can configure its services and service areas without becoming publicly listed.
- Public profile publication is explicit and reversible.

## E3 — Single-business quote inbox

This is the first new customer-facing capability.

### Flow

```text
Customer submits quote form on one business website
→ validated workspace-scoped quote request
→ business quote inbox
→ business drafts/sends one offer
→ customer accepts or declines
```

### Work

- Structured quote request with attachments, consent version and abuse controls.
- Workspace-scoped inbox states: new, qualified, quoted, accepted, declined, archived.
- Offer scope, price model, validity and revision history.
- Notifications with idempotent delivery records.

### Gate

- A quote submitted to one business is never visible to another.
- Duplicate submission and retry behavior is controlled.
- No multi-provider matching exists yet.

## E4 — Shared service-job backbone

Booking and accepted quotes remain different request types but converge into a common fulfilled job.

```text
Confirmed booking ─┐
                   ├→ ServiceJob → assigned → in_progress → completed/cancelled
Accepted offer ────┘
```

### Work

- Service jobs, assignments, status events, notes, attachments and completion evidence.
- Idempotent conversion from booking or accepted offer.
- CRM timeline integration.
- Audit events for every lifecycle transition.

### Gate

- One source request creates at most one service job.
- State transitions are server-controlled and tested.

## E5 — Verified reviews

- Review eligibility only from a completed service job.
- One review per job/customer eligibility record.
- One-time review token, moderation, provider response and abuse reporting.
- Rating aggregates derived from published reviews only.

## E6 — Optional Booking Pro

Enable only for workspaces that need schedule inventory:

- Staff and resources.
- Staff-service assignment.
- Recurring availability, breaks and exceptions.
- Atomic conflict prevention.
- Customer reschedule/cancel policies.
- Waiting list after core booking reliability is verified.

## E7 — Limited public provider network

Launch as a controlled pilot, not a Sweden-wide marketplace:

- One geographic area and a small number of service categories.
- Verified providers only.
- Public provider profile, category/area pages and deterministic search.
- Booking or single-business quote CTA.
- No sponsored ranking and no AI ranking.

Activation gate: minimum provider coverage and operational moderation capacity are documented for every enabled category/area.

## E8 — Multi-provider quote marketplace pilot

- Moderated structured requests.
- Rule-based eligibility by category, area, active status and capacity.
- Send to a small capped number of providers in the pilot.
- Explainable matching snapshot.
- Offers, comparison, single transactional award and service-job creation.
- Request-scoped communication and contact-data disclosure rules.

Do not claim Offerta-style coverage until provider supply and response metrics prove it.

## E9 — Payments

Start with business-owned payments:

- Payment link, deposit or full payment from customer to the business.
- Cancellation/refund policy and audit trail.

Defer marketplace payouts, platform fee splitting and Stripe Connect until legal, accounting, dispute and operational requirements are approved.

## E10 — AI and automation

AI is assistive first:

- Category/scope extraction.
- Missing-information questions.
- Draft offers and replies.
- Lead scoring and follow-up suggestions.
- Job and conversation summaries.

Initial prohibitions:

- No autonomous provider award.
- No autonomous final pricing.
- No unsupervised external sending.
- No autonomous refund or payment mutation.

## Explicitly deferred

- Gift cards and consumer memberships.
- Native mobile applications.
- Sponsored marketplace ranking.
- Nationwide marketplace launch.
- AI-only matching.
- Marketplace payouts and complex dispute handling.

## Definition of done

A node is complete only when:

- prerequisites are complete;
- migration and rollback guidance exist where applicable;
- server-side authorization is verified;
- positive and negative tests pass;
- public writes have validation and abuse controls;
- audit and delivery behavior is observable;
- Preview verification succeeds;
- protected legacy flows remain operational;
- documentation and module status are current.
