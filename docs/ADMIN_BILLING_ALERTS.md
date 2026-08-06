# Admin Billing Alerts

## Current scope

The billing alert system is intentionally read-only. It detects and displays:

- trial ending within 7 days
- trial ending within 3 days
- trial ending tomorrow
- trial expired
- past due

No email, SMS, webhook, or other external notification is sent by this phase.

## Existing delivery infrastructure review

Proffera already sends booking reminder emails through Brevo. Booking reminders claim a delivery row with `ON CONFLICT DO NOTHING`, then record sent, skipped, or failed status. That pattern is appropriate for future billing notifications, but the existing template and recipient policy are booking-specific and must not be reused without review.

There is currently no approved billing-alert email template, recipient resolution policy, or billing-alert delivery table.

## Idempotency

Each detected billing alert receives a deterministic key based on:

- workspace ID
- alert kind
- current billing period end

The Admin UI renders one alert per key. The key itself is not displayed. This prevents duplicate entries in the read-only queue and provides the future unique claim key for delivery persistence.

## Enabling delivery later

Before any real email is sent:

1. Approve the billing email template and exact recipient rules.
2. Create a dedicated delivery table with a unique constraint on the deterministic key.
3. Record pending, sent, skipped, and failed results with provider ID and error message.
4. Test the migration on a Neon temporary branch.
5. Report the temporary branch and migration ID.
6. Obtain explicit approval before applying the migration to Production.
7. Obtain explicit approval before sending any real billing email.

Until those controls are complete, delivery remains disabled and there are no send results or errors to persist.
