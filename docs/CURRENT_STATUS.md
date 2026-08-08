# Proffera Current Status

Last updated: 2026-08-08

## Release baseline

The current verified source baseline includes technical changes through PR #400 (`8eb64d7` before this documentation-only update).

Do not describe a source change as live in Production unless the corresponding Vercel Production deployment is independently verified as READY, the production domains point to it, and the affected runtime smoke checks pass. Vercel project/deployment state could not be independently read from the connected Vercel tool in the 2026-08-08 hardening session, so source readiness and Production deployment readiness remain separate claims.

## What is implemented and source-verified

### Authentication, Workspace isolation and Platform Admin

- Better Auth-backed sign-in and session handling.
- Session-derived Workspace membership with `owner`, `admin`, `staff`, and `viewer` roles.
- Workspace-scoped customer, booking, lead, offer, review, billing and service-work access.
- Preview database/auth secret resolution fails closed instead of falling back to Production.
- Dashboard Booking→Customer reads and the Booking status mutation bind related Customer rows to the same Workspace.
- Permanent tenant-boundary regression coverage protects the active Dashboard Booking readers.
- Platform Admin routing forwards the exact `/admin/...` path into the server-side role policy.
- The old shared `ADMIN_ACCESS_CODE` Basic Auth proxy gate was removed; sensitive admin APIs continue to enforce Better Auth / Platform Admin RBAC and origin checks inside the route.
- `/admin/status` is now a read-only Operations Health surface available to Platform Admin roles.

### Feature access, Booking themes and Gallery

- The database Feature Catalog / entitlement resolver is the canonical capability-access source.
- Trial, plan, Workspace enablement and Platform Admin overrides are resolved centrally.
- Public Booking and Gallery no longer use a second direct `workspace_plans.status` gate for theme/gallery rendering.
- Saved Booking theme and appearance are resolved consistently for active/trial Workspaces.
- Public Gallery publication requires both the Workspace gallery toggle and the canonical `media_gallery` entitlement.
- Five Booking presets remain supported: `clean`, `salon`, `premium`, `modern`, and `minimal`.

### Booking, CRM, Jobs and Reviews

- Public Booking, email verification, availability, booking management and customer portal foundations are implemented.
- Booking hours, staff schedules, time off, overlap/conflict checks and rescheduling foundations are implemented.
- Confirming a Booking creates at most one Booking-backed Service Job.
- Completing/cancelling a Booking synchronizes its linked Service Job; Booking completion records completion evidence.
- Quote/Offer acceptance creates at most one Offer-backed Service Job.
- Booking completion and direct linked Service Job completion enter the Verified Review invitation path.
- Verified Review token hashing, eligibility, one-time redemption, moderation and publication protections remain implemented.
- A cross-module Golden Lifecycle Contract now blocks CI if the critical Booking/Offer→Job→Completion→Review connections drift apart.

### Billing and notifications

- Stripe Checkout, Customer Portal, subscription webhook synchronization and billing-alert foundations are implemented.
- Booking reminder delivery infrastructure and duplicate-delivery protection are implemented.
- Offer email delivery tracking is implemented.
- Automatic tax must remain disabled until required registrations and legal/business review are complete.
- Application code must not invent unsupported currency prices outside configured Stripe Prices.

## Database hardening status

### Production observations

Read-only inspection on 2026-08-08 found:

- 49 public tables;
- all inspected public tables had primary keys;
- 70 existing foreign-key constraints before the new tenant-relation migration;
- zero public tables with RLS enabled;
- the current Production connection role is `neondb_owner` and can bypass RLS.

Therefore, simply enabling RLS while continuing to connect as the current owner role would not provide effective tenant isolation.

### Tenant relation migration staged, not yet applied to Production

Migration `db/migrations/20260808_0033_tenant_relation_constraints.sql` is merged to source but has **not** been applied to Production yet.

The exact migration was tested on two isolated Neon branches cloned from Production:

- first execution succeeded;
- final source version succeeded;
- rerunning the final version succeeded;
- all added constraints validated;
- a negative test attempting to connect a Booking to a Customer from another Workspace was rejected by the database;
- both temporary verification branches were deleted after testing.

Production still reports 0/17 of these new validated tenant-aware constraints until the controlled Production migration is explicitly committed.

### RLS follow-up blocker

Legacy `workspace_id` columns are split between text and UUID storage. Read-only validation found five non-UUID legacy rows using `workspace_id='default'`:

- four rows in `workspace_services`;
- one row in `workspace_settings`.

They describe an older Iboren seed/configuration. There is no sufficiently proven historical Workspace mapping to justify silently remapping them to a current Workspace. Do not guess this mapping.

Broader UUID normalization and effective RLS therefore remain a later controlled phase requiring:

1. an explicit legacy-default cleanup decision;
2. a restricted application database role that does not bypass RLS;
3. a tested per-request tenant-context design;
4. corresponding deployment-environment changes and rollback verification.

## Migration discipline

`db/migrations/` is now the single active migration source of truth.

- the split AI Chat migration was moved into the canonical sequence;
- Gallery migrations were moved into the canonical history;
- the pre-Workspace Quote Request migration was preserved under `db/legacy-migrations/` for history only;
- `docs/POSTGRES_SETUP.md` now documents the safe Neon branch-first workflow.

A merged SQL file is not proof of Production execution.

## Build and CI hardening

Top-level dependencies are pinned to the exact versions already resolved by the current lockfile. `npm ci` succeeded with those exact specs, proving the change did not intentionally upgrade or downgrade packages.

Every focused hardening PR in the 2026-08-08 session passed the repository gate before merge:

- dependency install;
- ESLint;
- TypeScript typecheck;
- Vitest;
- Next.js production build;
- whitespace validation.

## Operations Health

The read-only Platform Admin Operations Health surface checks, without exposing secret values or customer content:

- required deployed configuration presence;
- database connectivity and current role posture;
- tenant-constraint coverage;
- RLS/BYPASSRLS posture;
- reminder failures and overdue reminders;
- Offer email failures/stale pending delivery;
- past-due subscriptions;
- legacy `workspace_id='default'` rows.

A read-only Production health snapshot during the hardening session showed:

- reminder failures in last 24h: 0;
- overdue pending reminders: 0;
- Offer email failures in last 24h: 0;
- stale pending Offer emails: 0;
- past-due subscriptions: 0;
- new tenant constraints active in Production: 0/17 (expected until migration #0033 is committed).

## Read-only Production product snapshot

The latest read-only counts observed during the 2026-08-08 audit were:

| Metric | Count |
| --- | ---: |
| Workspaces | 5 |
| Workspace memberships | 9 |
| Customers | 16 |
| Bookings | 43 |
| Service jobs | 22 |
| Website reviews | 1 |
| Quote requests | 0 |
| Quote offers | 0 |
| Billing subscriptions | 4 |

Cross-module Production invariant checks returned zero violations for:

- confirmed Booking without linked Service Job;
- completed Booking without linked Service Job;
- accepted Offer without linked Service Job;
- completed Booking with customer email but no Review Invitation.

## Remaining release proof

The following must still be treated as operational proof work rather than assumed complete from source tests:

1. Commit and verify migration `20260808_0033_tenant_relation_constraints.sql` in Production through the controlled Neon migration workflow.
2. Independently verify the current `main` Vercel Production deployment, domains and runtime environment configuration.
3. Run a browser-level authenticated two-account Workspace isolation smoke test with dedicated test accounts.
4. Complete a controlled real Booking → reminder → completion → review-email → one-time review → moderation → publication flow.
5. Complete a controlled Quote Request → Offer → email → Accept/Reject → Service Job flow with designated test data.
6. Complete a Service Job assignment → in-progress → completion flow with controlled evidence.
7. Verify Stripe Sandbox Checkout + webhook state for Sweden, a supported EU business and a UK business.
8. Verify Preview authentication/database behavior against the isolated Preview environment once its live Vercel deployment can be inspected.

## Current blockers / non-goals

- Browser E2E is not yet automated with Playwright/Cypress in this repository.
- Vercel Production/Preview projects and runtime environment values were not independently visible through the connected Vercel tool during this session; do not fabricate deployment claims.
- Full RLS enforcement is intentionally deferred until legacy Workspace normalization and a restricted app DB role can be proven safely.
- Do not add major new product features until the remaining Production proof above is completed.
