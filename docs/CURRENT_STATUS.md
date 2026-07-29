# Proffera Current Status

Last updated: 2026-07-29

## Production status

Production is deployed from `main`. The latest verified production baseline is
commit `9e78423` (Graph Engineering worker protocol); the booking-reminder
scheduler was merged earlier in commit `b527be6`.

## Booking reminders

The reminder delivery path is deployed and configured:

```text
GitHub Actions (every 15 minutes)
  -> /api/cron/booking-reminders (Bearer secret)
  -> Neon PostgreSQL
  -> Brevo email / SMS provider when a booking is due
```

- Vercel Hobby-compatible scheduling is provided by GitHub Actions, so normal
  reminder runs do not create Vercel deployments.
- Production tables `workspace_booking_reminder_settings` and
  `booking_reminder_deliveries` exist.
- Default behavior for a workspace without a saved settings row is enabled,
  24 hours before the booking, through email and SMS when customer contact
  information is available.
- The unique delivery constraint prevents duplicate sends across repeated
  scheduler runs.
- At the last database check, no workspace-specific reminder settings or
  delivery records existed. This means no reminder has yet been observed as
  sent, skipped, or failed in production.

## Verified safety controls

- Billing safety: Checkout reuses only the matching open session, expires a
  mismatched open session, and webhooks read the current Stripe subscription
  before syncing access.
- Public-write safety: demo, quote and public-booking requests have durable
  database-backed rate limiting; demo consent and its version are stored; the
  public booking customer/booking write is atomic.
- Workspace controls: membership, role, feature access, customer ownership and
  workspace-specific settings are protected flows.
- Deployment discipline: production changes are validated locally and merged
  in focused pull requests.

## Release actions still required before commercial launch

1. Run the full Phase 5 checklist in a Vercel Preview and Stripe Sandbox:
   demo registration, booking, emails, team invitations, payment, cancellation
   and subscription upgrade. Do not use real cards or customer data without
   explicit approval.
2. Have the legal/business owner supply the controller's legal name,
   organisation number and address, final processor list, Terms and Privacy
   content before public commercial launch.
3. Confirm Service AI Chat messages and leads remain isolated to tenant
   `proffera`; AI is not part of the active paid promise until that test passes.
4. Before onboarding real businesses, replace the MVP `workspace_id = default`
   boundary and Basic Auth assumptions with the planned production auth and
   workspace model. This is a separate high-risk database/auth change and
   requires its own approved migration plan.

## Next safe verification

Review the first scheduled GitHub Actions run that has a due booking. Its API
response and the corresponding row in `booking_reminder_deliveries` must be
checked before claiming end-to-end email or SMS delivery is verified. Do not
trigger a manual run against real customer bookings solely for this check.
