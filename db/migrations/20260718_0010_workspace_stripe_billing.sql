-- P103: Stripe subscription state for Proffera workspaces.
-- Apply in Neon before enabling the Stripe checkout button in production.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_billing_subscriptions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  workspace_plan_id uuid REFERENCES workspace_plans (id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'pending',
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_event_created bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_billing_subscriptions_workspace_unique
    UNIQUE (workspace_id),
  CONSTRAINT workspace_billing_subscriptions_status_check
    CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_billing_subscriptions_stripe_subscription_unique_idx
  ON workspace_billing_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_billing_subscriptions_stripe_checkout_unique_idx
  ON workspace_billing_subscriptions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_billing_subscriptions_status_idx
  ON workspace_billing_subscriptions (status);

COMMIT;
