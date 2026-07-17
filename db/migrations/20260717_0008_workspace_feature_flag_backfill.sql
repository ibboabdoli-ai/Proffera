-- Give existing active/trial workspaces the same base modules as newly activated workspaces.
-- Safe to run more than once: existing flag choices are preserved.

BEGIN;

INSERT INTO workspace_feature_flags (id, workspace_id, feature_key, enabled)
SELECT gen_random_uuid(), w.id, feature.feature_key, true
FROM workspaces w
CROSS JOIN (
  VALUES
    ('booking_demo'),
    ('crm_customers'),
    ('lead_inbox')
) AS feature(feature_key)
WHERE w.status IN ('active', 'trial')
ON CONFLICT (workspace_id, feature_key) DO NOTHING;

COMMIT;
