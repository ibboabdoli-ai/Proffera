# Admin Billing Safety

## Source of truth

For workspaces with a Stripe subscription, Stripe is the financial source of truth. The webhook verifies the signature, retrieves the current subscription snapshot from Stripe, and then synchronises Proffera.

Stripe-owned fields:

- subscription status
- current period start and end
- cancel-at-period-end
- Stripe price to Proffera plan mapping

The Admin Billing page reads those fields from `workspace_billing_subscriptions` when `stripe_subscription_id` exists. `workspace_plans` remains the internal entitlement projection updated by the webhook.

## Permitted admin mutation

The only billing mutation currently exposed to platform admins is a controlled extension of an internal, non-Stripe trial. It:

- requires `super_admin` or `billing_admin`
- accepts only 3, 7, 14, or 30 days
- requires a reason
- requires the latest plan to remain `trialing`
- compares the expected period end to reject stale or duplicate submissions
- blocks every workspace with a Stripe subscription identifier
- writes `billing.trial_extended` with previous and new values in the same atomic statement

## Read-only operations

These remain read-only until an explicit Stripe workflow is implemented and verified:

- plan change
- subscription status change
- cancellation
- refund

No admin route may write those values directly into Proffera as a substitute for Stripe.

## Private payment data

The Admin Billing UI must never expose:

- Stripe customer, subscription, checkout-session, or price identifiers
- payment method data
- card data

Proffera does not store or display card details.

## Webhook safety

`/api/stripe/webhook` validates the Stripe signature and retrieves Stripe's current subscription before synchronising. Event ordering is guarded by `last_event_created`, and entitlement changes are derived from the synchronised Stripe status.

## Explicit exception: Maria's initial isolated Preview trial (no Production)

The Preview-only admin billing screen may expose **one** start action for the
existing workspace with slug `makeup-by-maria` while it has no plan at all.
It is not a plan change, a trial extension, a Stripe subscription, or a
general-purpose billing editor. This exception is disabled in Production.

- Require `VERCEL_ENV=preview`, authenticated `super_admin`, matching UUID
  and workspace slug, and a mandatory 8–500 character audit reason.
- Reject any existing plan or billing subscription (including non-Stripe
  records); refuse a manual `online_booking` denial.
- Serialize competing submissions with a transaction-scoped try-lock.
- In one atomic SQL statement create the internal Starter trial ending
  exactly 14 days from the database clock, enable Maria's booking module flag,
  and write `billing.maria_preview_trial_started` to the admin audit log.
- No Stripe API calls, price changes, public booking activation flag,
  outgoing notifications, customer bookings, or existing calendar rows.
- Database isolation remains enforced by `resolveDatabaseUrl`: Preview
  requires `PROFFERA_PREVIEW_DATABASE_URL` and rejects shared DB targets.
- This alone does **not** deploy the draft Maria calendar or apply
  `20261103_0072_maria_manual_closed_starts.sql`. Calendar migration needs
  separate isolated Preview execution and post-migration acceptance before
  any real booking test.

Release discipline: draft PR, current-head CI/review and Maria Preview
acceptance required. Do not merge or deploy this admin exception to Production.
