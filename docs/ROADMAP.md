# Proffera Roadmap

Last updated: 2026-08-08

## Current priority: Production proof before new features

Proffera has enough product breadth for controlled customer pilots. The current priority is to prove and harden the existing end-to-end system rather than add major new modules.

## P0 — Finish release safety

1. Commit and verify `20260808_0033_tenant_relation_constraints.sql` through the controlled Neon migration workflow.
2. Verify the current `main` Vercel Production deployment, domains and required runtime configuration independently.
3. Run a dedicated two-account Workspace-isolation smoke test across Dashboard customer/booking/admin surfaces.
4. Run the controlled Booking → reminder → completion → Verified Review lifecycle with designated test recipients.
5. Run the controlled Quote Request → Offer → email → Accept/Reject → Service Job lifecycle.
6. Run one Service Job through assignment, progress and completion evidence.
7. Verify Stripe Sandbox Checkout/webhook behavior for Sweden, a supported EU business and a UK business.

## P1 — Database tenant defense

1. Decide how the five historical `workspace_id='default'` Iboren rows should be archived or mapped; do not guess a current Workspace.
2. Normalize legacy Workspace IDs only after that decision is evidenced and tested on a Neon branch.
3. Introduce a restricted application database role that cannot bypass RLS.
4. Design and test per-request tenant context.
5. Enable RLS incrementally on tenant-owned tables, with negative cross-tenant tests and rollback verification before Production rollout.

## P1 — Operations and automated release proof

- Keep `/admin/status` Operations Health aligned with real operational failure modes.
- Add browser-level E2E once a stable Preview runtime can be exercised reliably.
- Automate a Golden browser path around signup/onboarding, Booking, Job and Review without using real customer Workspaces.
- Add deployment/runtime observability only where it produces actionable failure signals; avoid duplicate dashboards that do not affect operations.

## P1 — Product polish

- Continue UI consistency work through the shared Dashboard and Booking design system rather than page-specific patches.
- Validate all five Booking themes on mobile and desktop with real Preview rendering.
- Complete Swedish/English consistency checks for settings, empty states, errors and public customer flows.
- Keep plan/trial/admin-override access behind the canonical Feature Catalog entitlement model.

## Pilot rollout

After P0 Production proof is green:

1. onboard up to five controlled pilot businesses;
2. observe real booking/notification/job/review behavior;
3. fix operational and UX defects before expanding scope;
4. move toward approximately twenty pilots only after the first cohort is stable;
5. resume large feature development based on observed customer demand, not speculative breadth.

## Guardrails

- Never connect Preview to the Production database merely to make a smoke test pass.
- Never claim a Git merge is live until the matching Production deployment is verified.
- Never remap legacy tenant data to a current Workspace without evidence.
- Never rely on application scoping alone when a database-level tenant invariant can safely reinforce it.
- Never charge a currency/tax amount that is not configured and confirmed by Stripe.
- Keep automatic tax disabled until required registrations and legal/business review are complete.
- Do not use real customer Workspaces for destructive or access-control experiments.
- Do not add major new product modules while existing critical lifecycles still lack controlled Production proof.
