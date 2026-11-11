-- Issue #988: Starter SMS metering (schema only; do NOT run on Production without approval).
BEGIN;
ALTER TABLE workspace_billing_subscriptions ADD COLUMN IF NOT EXISTS sms_monthly_limit integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_billing_sms_limit_check') THEN
    ALTER TABLE workspace_billing_subscriptions
      ADD CONSTRAINT workspace_billing_sms_limit_check
      CHECK (sms_monthly_limit IS NULL OR sms_monthly_limit IN (50, 100));
  END IF;
END $$;

-- Starter SMS is a paid feature. Existing SMS trials must never substitute
-- for the subscription check performed in the reservation function.
UPDATE feature_catalog
SET minimum_plan = 'starter', trial_days = 0
WHERE feature_key = 'sms';

CREATE TABLE IF NOT EXISTS workspace_sms_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  delivery_key text NOT NULL,
  units integer NOT NULL CHECK (units BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'sent', 'uncertain', 'rejected')),
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_sms_dispatches_unique UNIQUE (workspace_id, delivery_key),
  CONSTRAINT workspace_sms_dispatches_period CHECK (period_end > period_start)
);
CREATE INDEX IF NOT EXISTS workspace_sms_dispatches_usage_idx
 ON workspace_sms_dispatches (workspace_id, stripe_subscription_id, period_start, status);

CREATE OR REPLACE FUNCTION reserve_workspace_starter_sms(
  p_workspace_id uuid, p_delivery_key text, p_units integer
) RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE
  b record;
  v_used bigint;
BEGIN
  IF p_workspace_id IS NULL OR p_delivery_key IS NULL
    OR length(p_delivery_key) NOT BETWEEN 8 AND 200
    OR p_units IS NULL OR p_units NOT BETWEEN 1 AND 100 THEN
    RETURN 'invalid';
  END IF;

  SELECT billing.stripe_subscription_id, billing.current_period_start,
         billing.current_period_end, billing.sms_monthly_limit
  INTO b
  FROM workspace_billing_subscriptions billing
  JOIN workspace_plans plan
    ON plan.id = billing.workspace_plan_id
   AND plan.workspace_id = billing.workspace_id
  JOIN workspace_feature_flags flag
    ON flag.workspace_id = billing.workspace_id
   AND flag.feature_key = 'sms' AND flag.enabled = true
  WHERE billing.workspace_id = p_workspace_id
    AND billing.status = 'active'
    AND plan.status = 'active'
    AND plan.plan_key = 'starter'
    AND billing.stripe_customer_id IS NOT NULL
    AND billing.stripe_subscription_id IS NOT NULL
    AND billing.stripe_price_id IS NOT NULL
    AND billing.current_period_start <= now()
    AND billing.current_period_end > now()
    AND plan.current_period_end > now()
    AND billing.sms_monthly_limit IN (50,100)
  FOR UPDATE OF billing;

  IF NOT FOUND THEN RETURN 'not_entitled'; END IF;

  -- One billing-row lock serializes reservations across independent workers.
  -- Sum is evaluated AFTER the lock, so simultaneous requests cannot overspend.
  IF EXISTS (
    SELECT 1 FROM workspace_sms_dispatches d
    WHERE d.workspace_id=p_workspace_id AND d.delivery_key=p_delivery_key
  ) THEN RETURN 'duplicate'; END IF;

  SELECT COALESCE(SUM(d.units),0) INTO v_used
  FROM workspace_sms_dispatches d
  WHERE d.workspace_id=p_workspace_id
    AND d.stripe_subscription_id=b.stripe_subscription_id
    AND d.period_start=b.current_period_start
    AND d.status IN ('reserved','sent','uncertain');

  IF v_used + p_units > b.sms_monthly_limit THEN RETURN 'quota_exhausted'; END IF;

  INSERT INTO workspace_sms_dispatches (
    workspace_id, stripe_subscription_id, period_start, period_end,
    delivery_key, units, status
  ) VALUES (
    p_workspace_id, b.stripe_subscription_id, b.current_period_start,
    b.current_period_end, p_delivery_key, p_units, 'reserved'
  ) ON CONFLICT (workspace_id,delivery_key) DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate'; END IF;
  RETURN 'reserved';
END
$fn$;
COMMIT;
