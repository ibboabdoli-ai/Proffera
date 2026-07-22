# Proffera Roadmap

## Current priority: controlled paid launch

The authoritative sequence is [`MASTER_PLAN.md`](MASTER_PLAN.md). Local phases
0–4 are complete on the current release-candidate branch; Phase 5 requires
Preview/Sandbox verification and owner approvals.

1. Apply the public-form safety migration in Preview and run the full release
   checklist.
2. Verify Stripe Checkout, current-subscription webhook sync, portal, upgrade
   and cancellation in Stripe Sandbox.
3. Confirm public booking, consent capture, notification delivery and rate
   limiting with Preview data only.
4. Supply final legal controller details, processor list and approved commercial
   terms before public sales.
5. Verify Service AI Chat is tenant-isolated to `proffera` before presenting it
   as an available integration.

## Product sequence after launch verification

- Improve authentication and workspace onboarding only with focused permission
  and migration tests.
- Add analytics, reminders, automation and AI only as separately scoped modules.
- Keep AI decisions draft-first with human review; no automatic customer-facing
  AI actions without an explicit plan.

## Guardrails

- Do not merge Service AI Chat or share its database with this project.
- Do not claim planned modules are active.
- Do not use live payments or real customer data for verification without
  explicit approval.
- Protect quote, demo, booking, workspace and Stripe subscription flows.
