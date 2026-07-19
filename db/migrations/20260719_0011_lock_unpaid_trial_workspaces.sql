-- P105: New workspaces require a paid plan before customer-facing modules are enabled.
-- Apply in Neon after the Stripe billing migration.

BEGIN;

UPDATE workspace_feature_flags wff
SET enabled = false, updated_at = now()
WHERE wff.feature_key IN ('booking_demo', 'crm_customers', 'lead_inbox')
  AND EXISTS (
    SELECT 1
    FROM workspace_plans wp
    WHERE wp.workspace_id = wff.workspace_id
      AND wp.status = 'trialing'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_billing_subscriptions wbs
    WHERE wbs.workspace_id = wff.workspace_id
      AND wbs.status IN ('active', 'trialing')
  );

UPDATE workspace_plans wp
SET status = 'cancelled', updated_at = now()
WHERE wp.status = 'trialing'
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_billing_subscriptions wbs
    WHERE wbs.workspace_id = wp.workspace_id
      AND wbs.status IN ('active', 'trialing')
  );

COMMIT;
