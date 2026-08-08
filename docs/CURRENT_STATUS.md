# Proffera Current Status

Last updated: 2026-08-08

## Release baseline

The current verified source baseline includes the 2026-08-08 hardening series through PR #403 on `main` plus the migration-source synchronization in progress on this branch.

Do not describe a source change as live in Production unless the corresponding Vercel Production deployment is independently verified as READY, the production domains point to it, and the affected runtime smoke checks pass. Vercel project/deployment state could not be independently read from the connected Vercel tool in the 2026-08-08 hardening session, so source readiness and Production deployment readiness remain separate claims.

Two database hardening migrations are independently verified Production facts:

- tenant relation migration `6f44f340-789b-4ca9-afd2-ac6c69f5ab56`;
- legacy default Workspace cleanup migration `867f3b4b-7b97-49c1-b6ba-4e4e8cbb225f`.

Both were applied successfully to the Production Neon parent branch on 2026-08-08 through the controlled branch-first migration workflow and passed post-migration read-only verification.

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
- `/admin/status` is a read-only Operations Health surface available to Platform Admin roles.

### Feature access, Booking themes and Gallery

- The database Feature Catalog / entitlement resolver is the canonical capability-access source.
- Trial, plan, Workspace enablement and Platform Admin overrides are resolved centrally.
- Public Booking and Gallery do not use a second direct `workspace_plans.status` gate for theme/gallery rendering.
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
- A cross-module Golden Lifecycle Contract blocks CI if the critical Booking/Offer→Job→Completion→Review connections drift apart.

### Billing and notifications

- Stripe Checkout, Customer Portal, subscription webhook synchronization and billing-alert foundations are implemented.
- Booking reminder delivery infrastructure and duplicate-delivery protection are implemented.
- Offer email delivery tracking is implemented.
- Automatic tax must remain disabled until required registrations and legal/business review are complete.
- Application code must not invent unsupported currency prices outside configured Stripe Prices.

## Database hardening status

### Production observations

Read-only inspection on 2026-08-08 found:

- 49 public tables at the initial audit point;
- all inspected public tables had primary keys;
- zero public tables with RLS enabled at the audit point;
- the current Production connection role is `neondb_owner` and can bypass RLS.

Therefore, simply enabling RLS while continuing to connect as the current owner role would not provide effective tenant isolation.

### Tenant relation defense — complete in Production

Canonical migration: `db/migrations/20260808_0033_tenant_relation_constraints.sql`.

Production migration ID: `6f44f340-789b-4ca9-afd2-ac6c69f5ab56`.

Post-migration Production verification showed:

- 17/17 tenant-aware relation constraints validated;
- 7/7 supporting composite indexes present;
- zero cross-Workspace violations across the rechecked Booking→Customer, Booking→Staff, Customer Event, Service Job→Offer/Request and Review→Invitation edges.

The canonical migration source is kept parser-safe and matches the DDL behavior used by the successful Neon workflow.

### Legacy `workspace_id='default'` cleanup — complete in Production

Canonical migration: `db/migrations/20260808_0034_legacy_default_workspace_cleanup.sql`.

Production migration ID: `867f3b4b-7b97-49c1-b6ba-4e4e8cbb225f`.

Before cleanup, read-only validation proved that only five legacy seed rows used the historical `default` sentinel: four services and one settings row. No Booking, Customer, Staff, Reminder or Customer Event depended on that Workspace ID.

The controlled Production migration:

- archived all five source rows with their original payloads;
- removed them from the active settings/services tables;
- removed the historical column defaults that could recreate `workspace_id='default'`;
- added validated UUID-shape guards on the two remaining text Workspace-ID columns involved in the cleanup.

Post-migration Production verification showed:

- archive rows: 5;
- active `workspace_id='default'` rows in settings: 0;
- active `workspace_id='default'` rows in services: 0;
- UUID-shape guards validated: 2;
- old `default` column defaults removed: 2/2.

The historical `default` sentinel is no longer an RLS blocker.

### Remaining RLS blocker

The main remaining database-isolation blocker is architectural, not dirty tenant data:

1. Production application traffic currently connects through `neondb_owner`, which can bypass RLS and owns the tables.
2. Application queries do not yet establish a transaction-scoped Workspace context in PostgreSQL.
3. RLS policies therefore must not be enabled in Production until a restricted application role and tenant-context path are proven on an isolated Neon branch.

Legacy tenant columns are still split between text and UUID storage. Immediate type normalization is not required solely to implement RLS: a single canonical Workspace context can safely be compared as UUID on UUID tables and as text on legacy text tables. Large type rewrites should be deferred unless they produce a separate operational benefit.

## Migration discipline

`db/migrations/` is the single active migration source of truth.

- split historical migration roots were consolidated;
- the pre-Workspace Quote Request migration remains under `db/legacy-migrations/` for history only;
- `docs/POSTGRES_SETUP.md` documents the Neon branch-first workflow;
- regression coverage checks that the tenant hardening migrations remain parser-safe and preserve the Production cleanup contract.

A merged SQL file is not proof of Production execution. The Production migration IDs above are the execution evidence.

## Build and CI hardening

Top-level dependencies are pinned to the exact versions already resolved by the lockfile. Every focused hardening PR must pass the repository gate before merge:

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

Latest verified database hardening signals:

- tenant constraints: 17/17;
- legacy default settings rows: 0;
- legacy default service rows: 0;
- cross-Workspace relation violations in rechecks: 0.

The remaining database warning is the RLS posture: the runtime owner role can bypass RLS and full RLS rollout is intentionally deferred until the restricted-role/tenant-context design is proven.

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

1. Introduce and verify a restricted non-BYPASSRLS application database role on an isolated Neon branch.
2. Design and prove transaction-scoped Workspace context before enabling RLS.
3. Enable RLS incrementally on isolated branches with positive/negative cross-tenant tests before any Production rollout.
4. Independently verify the current `main` Vercel Production deployment, domains and runtime environment configuration.
5. Run a browser-level authenticated two-account Workspace isolation smoke test with dedicated test accounts.
6. Complete controlled Booking→Reminder→Completion→Review, Quote→Offer→Job and Service Job completion flows.
7. Verify Stripe Sandbox Checkout + webhook state for Sweden, a supported EU business and a UK business.
8. Verify Preview authentication/database behavior against the isolated Preview environment once its live Vercel deployment can be inspected.

## Current blockers / non-goals

- Browser E2E is not yet automated with Playwright/Cypress in this repository.
- Vercel Production/Preview projects and runtime environment values were not independently visible through the connected Vercel tool during this session; do not fabricate deployment claims.
- Full RLS enforcement is intentionally deferred until a restricted app DB role and transaction-scoped Workspace context are proven safely.
- Do not add major new product features until the remaining Production proof above is completed.
