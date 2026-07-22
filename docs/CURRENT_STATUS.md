# Proffera Current Status

Last updated: 2026-07-22

## Release candidate status

The active branch contains a controlled paid-launch candidate. It is **not yet
deployed to production**. The latest known `main` baseline before this work is
`08972a2`; the candidate branch can be rolled back by reverting its four scoped
commits.

Local release gates completed:

- Billing safety: Checkout now reuses only the matching open session, expires a
  mismatched open session, and webhooks read the current Stripe subscription
  before syncing access.
- Public write safety: demo, quote and public-booking requests have durable
  database-backed rate limiting; demo consent and its version are stored; the
  public booking customer/booking write is atomic.
- Product truth: public pages no longer present planned AI functionality or the
  former marketplace matching flow as an active paid feature.
- Delivery quality: lockfile-based install, Node 22 CI, lint, typecheck, build
  and focused Vitest checks are in place.

## Required release actions

These actions require the production owners and have deliberately not been run
from this branch:

1. Apply `db/migrations/20260722_0012_public_form_safety.sql` to Preview, then
   production, and verify the `public_submission_rate_limits` table plus the
   `company_registrations` consent columns.
2. Configure every required value in `.env.example` in Vercel. Generate a
   unique `PUBLIC_FORM_RATE_LIMIT_SECRET`; use Stripe test keys in Preview.
3. Run the Phase 5 checklist in a Vercel Preview and Stripe Sandbox. Do not use
   real cards or customer data without explicit approval.
4. Have the legal/business owner supply the controller's legal name,
   organisation number/address, final processor list and approved terms before
   public commercial launch.
5. Confirm Service AI Chat messages and leads remain isolated to tenant
   `proffera`; AI is not part of the active paid promise until that test passes.

## Active product boundary

- Active scope: booking, leads, customer CRM, workspace membership/invitations,
  email notifications and Stripe subscription plumbing.
- Planned/separate scope: AI assistant, analytics, reminders and automation.
- Proffera is a SaaS platform, not a public marketplace that promises matched
  jobs to demo applicants.

## Verification completed locally

```text
npm test          # 2 files, 5 tests passed
npm run lint       # passed
npm run typecheck  # passed
npm run build      # passed
```

## Protected flows

- Quote requests and company demo registration.
- Company approval, service editing, lead delivery and Brevo notifications.
- Workspace membership, role and feature access controls.
- Public bookings, booking overlap protection and booking notifications.
- Stripe signature verification and workspace-to-subscription binding.

## Next safe step

Open a pull request for this release candidate. After code review, use a Vercel
Preview and Stripe Sandbox to execute the release checklist; merge only after
the required migration, environment configuration and owner approvals are
recorded.
