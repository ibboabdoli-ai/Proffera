# Proffera Current Status

Last updated: 2026-08-06

## Release baselines

Proffera deploys from `main`, but source and Production are temporarily on
different commits because Vercel has rate-limited new builds after a large
number of rapid Preview deployments.

- Source baseline: `d50631c` on `main`.
- Production baseline: `5a8f3e5`, the merged PR #348 release.
- Production is healthy and remains unchanged while the build limit is active.
- The Verified Review email release in PR #349 and the trusted-origin hardening
  in PR #351 are merged to `main` but are not yet live in Production.

A release must not be described as live until the matching Production
Deployment is `READY`, the production domains point to it, and the relevant
runtime smoke checks pass.

## Delivered product capabilities

### SaaS foundation

- Better Auth-backed sign-in and session handling.
- Session-derived Workspace access with `owner`, `admin`, `staff`, and `viewer`
  roles.
- Workspace-scoped reads and writes for bookings, customers, leads, offers,
  settings, reviews, billing and service work.
- Central Platform Admin roles, route authorization and audit logging.
- Separation between customer Workspace accounts and Platform Admin accounts.

### Feature access and trials

- The Feature Catalog is the canonical source for dashboard capability access.
- New active Trial Workspaces receive the active catalog capabilities without
  customer-specific hardcoded provisioning.
- Route guards protect Leads, Offers, Gallery and Verified Reviews directly.
- After Trial expiry, normal plan-tier access applies again.

### Booking, CRM and customer operations

- Public booking, verification, availability and booking management.
- Workspace booking hours, staff scheduling structures and time-off support.
- Customer CRM, customer history, leads and booking events.
- Swedish and English public and dashboard experiences.
- Workspace country, currency and timezone foundations for Sweden, supported EU
  markets and the United Kingdom.
- Booking confirmations and a durable reminder scheduler with duplicate-delivery
  protection.

The reminder infrastructure exists, but a real due reminder has not yet been
verified end to end in Production.

### Billing and subscriptions

- Stripe-hosted Checkout and Customer Portal.
- Webhook-synchronised subscription state.
- Read-only Platform Billing views and alert detection.
- Controlled internal Trial extension with audit logging.
- Stripe remains the source of truth for Stripe-bound plans and statuses.

Automatic tax must remain disabled until the required registrations and legal
review are complete. Proffera must not invent local-currency prices outside the
configured Stripe Prices.

### AI Chat

- Workspace-level AI Chat integrations exist and can be activated independently.
- Tenant/client identifiers and lifecycle state are stored per Workspace.
- The capability is available for pilot use; it is not yet presented as a fully
  operationally proven mass-market module.

### Offers and service jobs

- Quote Request intake, Draft Offer editing, public offer links, PDF output and
  customer Accept/Reject foundations exist.
- Email-delivery and Service Job conversion structures exist.
- Service Job notes, events, attachments and completion evidence are supported.

The complete Request → Offer → Email → Accept → Job lifecycle still requires a
controlled end-to-end Production verification.

### Verified Reviews

The central multi-tenant Verified Review flow is implemented:

- invitations are issued only for eligible completed bookings;
- only SHA-256 token hashes are persisted;
- tenant, customer, booking and Workspace consistency are validated;
- invitation redemption and review creation are atomic;
- expired, revoked, reused and ineligible links are rejected;
- anonymous PrimeView submission is closed;
- only approved verified reviews are eligible for publication;
- moderation decisions and email outcomes are audited without raw tokens or
  review text leakage.

PR #349 adds Swedish/English Brevo delivery after a real transition to
`completed`, plus manual send/resend controls. PR #351 ensures private review
links are generated only from configured trusted origins, never from an incoming
request Host. Both changes are merged to `main` and await the next Production
Deployment.

## Verification status

The latest Verified Review hardening branch passed:

- lint;
- TypeScript typecheck;
- automated tests;
- production build;
- whitespace validation.

Production remained on the previous healthy Deployment because Vercel reported:
`Deployment rate limited — retry in 24 hours.`

## Preview environment limitation

Current Preview deployments do not have `DATABASE_URL`. Any Preview route that
initializes Proffera Auth therefore fails closed instead of providing a usable
authenticated Preview.

The correct fix is to configure an isolated Preview Neon branch through
branch-specific Vercel environment variables. Preview must not be connected to
the Production database merely to make smoke tests pass.

## Last read-only Production snapshot

An earlier successful read-only snapshot on 2026-08-06 showed:

| Metric | Count |
| --- | ---: |
| Workspaces | 4 |
| Workspace memberships | 8 |
| Customers | 16 |
| Bookings | 43 |
| Service jobs | 22 |
| Website reviews | 3 |
| Review invitations | 0 |
| Billing subscriptions | 4 |
| AI Chat integrations | 2 |

A later Neon Connector read failed authorization before query execution. No
Production database mutation was performed during that failure.

## Required operational proof

Before claiming broad production readiness, complete these controlled flows with
designated test data and recipients:

1. Deploy the current `main` after the Vercel build limit clears.
2. Complete Booking → Verified Review email → one-time link → submission →
   moderation → publication.
3. Trigger one real due booking reminder and verify duplicate prevention.
4. Complete Quote Request → Offer → Email → Accept/Reject → Service Job.
5. Move one Service Job through assignment, progress and completion.
6. Create test Staff schedules, time off and overlapping-booking checks.
7. Run a two-account Workspace-isolation smoke test with dedicated test accounts.
8. Verify Stripe Sandbox Checkout and webhook state for Sweden, an EU business
   and a UK business.

## Repository and operations cleanup

- Consolidate the duplicated `db/migrations` and `database/migrations` history
  into one documented migration source of truth.
- Configure a safe Preview database and required Preview environment variables.
- Reduce unnecessary Vercel Preview builds so rapid incremental commits do not
  exhaust the build quota.
- Keep this file aligned with the actual `main` commit and the separately
  verified Production Deployment.
