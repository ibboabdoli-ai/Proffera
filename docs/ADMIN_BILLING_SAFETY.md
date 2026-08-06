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
