# Proffera Master Plan — Controlled Paid Launch

Last updated: 2026-07-22

## Goal

Ship Proffera as a controlled, paid SaaS for Swedish service businesses.
The release scope is booking, lead handling, customer CRM, workspace access,
team invitations, and Stripe subscriptions. AI chat stays a separate,
explicitly planned integration until tenant delivery is verified.

## Product position

Proffera is a SaaS platform, not a public lead marketplace.

- **Starter:** public booking, contact forms, and lead inbox.
- **Professional:** Starter plus customer CRM, booking history, and service catalog.
- **Business:** a sales-led offer for multi-team or customised needs.
- **AI assistant, reminders, analytics, and automation:** planned; do not sell or
  describe them as active modules until they are delivered and verified.

The public Demo flow is an enquiry for a SaaS demo. It must not promise that
the applicant will receive marketplace-style matched requests.

## Release gates

No phase may be marked complete until its verification checks pass. Do not
begin the following phase with known failures in the current phase.

| Phase | Outcome | Required verification |
| --- | --- | --- |
| 0. Baseline | Scope, risks, docs, and rollback point are current | Clean branch, baseline lint/typecheck/build, documented checklist |
| 1. Billing safety | Stripe cannot create duplicate subscriptions or apply stale entitlement state | Unit/integration coverage where feasible, Stripe event ordering review, lint/typecheck/build |
| 2. Public write safety | Demo, company, quote, and booking inputs resist spam and preserve consent/audit data | Server validation, rate limits, database migration review, lint/typecheck/build |
| 3. Product truth | Site copy, CTA journey, SEO, pricing, and legal content match live capabilities | Route review and public-page smoke check |
| 4. Delivery quality | CI, tests, environment docs, operations docs, and release checklist are reliable | CI validates lint/typecheck/build/tests and docs are current |
| 5. Release verification | A controlled pilot flow is proven end to end | Manual checklist in Preview/Sandbox; no real payment or customer data without approval |

## Phase 0 — Baseline and release checklist

- Record the production commit and rollback branch.
- Establish a local reproducible toolchain and run lint, typecheck, and build.
- Keep this plan, `CURRENT_STATUS.md`, `ROADMAP.md`, and `TEST_CHECKLIST.md`
  aligned with the code.
- Do not treat historical phase documents as the current source of truth.

## Phase 1 — Stripe billing safety

### Must be true before paid launch

- A stale or out-of-order webhook cannot overwrite a newer subscription state.
- A second Checkout Session cannot leave a previous session payable for another plan.
- The customer portal handles payment recovery, cancellation, and invoices without
  showing a CTA that always fails.
- QR booking links are shown only when the public booking route is actually live.
- Stripe webhook events are traceable and idempotent.

### Protected flows

- Owner-only checkout, upgrade, and portal access.
- Stripe signature verification.
- Workspace-to-subscription binding.
- Feature flags derived from a confirmed subscription.

## Phase 2 — Public write safety and data handling

### Must be true before public acquisition

- Every public write has server-side schema validation, rate limiting, and a spam
  control appropriate to the form.
- Demo/company consent acceptance and policy version are stored with the request.
- A successful demo/company request produces an operational notification or a
  reliable inbox task.
- Booking database constraints remain the final protection against overlap.
- Failed booking inserts do not leave unwanted orphan customer records.
- Public-form errors are normal validation responses, not server errors.

## Phase 3 — Product truth, legal, and conversion

### Must be true before public sales

- Public copy states only what is active in the paid product.
- Demo CTA, confirmation page, and sales workflow describe one coherent SaaS
  onboarding journey.
- Pricing titles and structured metadata match the actual plan entitlements.
- Footer, Open Graph, FAQ, contact page, services page, and default metadata use
  the same product promise.
- Terms, privacy policy, cookies, subscription cancellation, and processor list
  are reviewed and match the implemented Stripe/Brevo/Neon/Vercel/AI-chat setup.

## Phase 4 — Engineering and operations

- Pin runtime and dependency versions through a lockfile and deterministic install.
- CI runs lint, TypeScript, build, and focused tests.
- Add `.env.example` without secrets and a production environment checklist.
- Add tests for billing event ordering, checkout session replacement, public forms,
  module access, and booking conflicts.
- Keep a small active-branch policy; archive obsolete backup branches only after
  verifying they are no longer required for rollback.

## Phase 5 — Controlled release verification

Run in a Vercel Preview and Stripe Sandbox:

1. Submit a Demo request and verify consent, notification, and deduplication.
2. Create/invite a workspace member and verify role-scoped access.
3. Start Starter checkout, confirm webhook entitlement, and open the portal.
4. Create a public booking and verify confirmation, owner notification, and no
   duplicate time slot.
5. Upgrade to Professional and verify CRM access.
6. Cancel at period end and verify the correct access state.
7. Test duplicate, delayed, and out-of-order Stripe webhook events.
8. Verify Service AI Chat traffic stays in the `proffera` tenant only.

## Non-goals during this release

- No full merge with `service-ai-chat`.
- No automatic AI sending or AI-assisted customer decisions.
- No public claim that planned modules are active.
- No production payment test that creates a real charge without explicit approval.
- No broad database migration unrelated to release safety.

## Definition of done

Proffera can be presented as a paid SaaS only when all release gates pass, the
legal/business owner approves the final public copy and policies, and the Phase
5 checklist is completed in Preview/Sandbox.
