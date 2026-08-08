# Proffera Roadmap

Last updated: 2026-08-08

## Current priority: Production proof before new features

Proffera has enough product breadth for controlled customer pilots. The current priority is to prove and harden the existing end-to-end system rather than add major new modules.

Two database defense layers are now complete in Production:

- tenant-relation hardening: 17/17 validated constraints and zero rechecked cross-Workspace violations;
- legacy default cleanup: five historical seed rows archived, zero active `workspace_id='default'` rows remaining, and recurrence guards active.

## P0 — Finish release safety

1. Verify the current `main` Vercel Production deployment, domains and required runtime configuration independently.
2. Run a dedicated two-account Workspace-isolation smoke test across Dashboard customer/booking/admin surfaces.
3. Run the controlled Booking → reminder → completion → Verified Review lifecycle with designated test recipients.
4. Run the controlled Quote Request → Offer → email → Accept/Reject → Service Job lifecycle.
5. Run one Service Job through assignment, progress and completion evidence.
6. Verify Stripe Sandbox Checkout/webhook behavior for Sweden, a supported EU business and a UK business.

## P1 — Database tenant defense

The historical `workspace_id='default'` blocker is closed. Do not remap the archived seed rows to a live Workspace.

Next sequence:

1. introduce a restricted application database role that cannot bypass RLS and does not own tenant tables;
2. design one transaction-scoped Workspace context for application requests;
3. prove that context against both legacy text Workspace-ID tables and UUID Workspace-ID tables on an isolated Neon branch;
4. add RLS policies incrementally to the smallest high-value table set first;
5. run positive same-Workspace and negative cross-Workspace tests using the restricted role;
6. expand table-by-table only after rollback and application behavior are verified;
7. migrate the Production runtime connection only after the branch proof, source changes, CI and deployment rollback path are complete.

Do not perform broad text→UUID column rewrites merely for consistency. The cleaned legacy text IDs are UUID-shaped and can participate safely in a canonical tenant-context design; normalize types later only when it has a separately justified benefit.

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
- Never remap archived legacy tenant data to a current Workspace without evidence and a separate migration decision.
- Never enable RLS while application traffic still relies on a table-owning/BYPASSRLS role and lacks transaction-scoped tenant context.
- Never rely on application scoping alone when a database-level tenant invariant can safely reinforce it.
- Never charge a currency/tax amount that is not configured and confirmed by Stripe.
- Keep automatic tax disabled until required registrations and legal/business review are complete.
- Do not use real customer Workspaces for destructive or access-control experiments.
- Do not add major new product modules while existing critical lifecycles still lack controlled Production proof.
