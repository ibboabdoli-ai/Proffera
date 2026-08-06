-- Platform-admin overrides for workspace feature entitlements.
-- An explicit override takes precedence over plan, trial, and workspace-level toggles.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_feature_overrides (
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES feature_catalog (feature_key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  reason text NOT NULL,
  created_by text REFERENCES "user" (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_feature_overrides_workspace_feature_pk
    PRIMARY KEY (workspace_id, feature_key)
);

CREATE INDEX IF NOT EXISTS workspace_feature_overrides_feature_key_idx
  ON workspace_feature_overrides (feature_key);

-- Preserve the unambiguous manual choices created by the first Platform Admin UI.
-- The ai_assistant key is intentionally not migrated because it was already a
-- canonical provisioning flag and cannot be distinguished from a manual change.
INSERT INTO workspace_feature_overrides (
  workspace_id,
  feature_key,
  enabled,
  reason,
  created_by,
  created_at,
  updated_at
)
SELECT
  f.workspace_id,
  mapping.canonical_key,
  f.enabled,
  'Migrated from legacy Platform Admin feature control',
  NULL,
  now(),
  now()
FROM workspace_feature_flags f
JOIN (
  VALUES
    ('booking_demo', 'online_booking'),
    ('crm_customers', 'crm'),
    ('lead_inbox', 'lead_management'),
    ('chat_widget', 'ai_chat')
) AS mapping(legacy_key, canonical_key)
  ON mapping.legacy_key = f.feature_key
JOIN feature_catalog c
  ON c.feature_key = mapping.canonical_key
ON CONFLICT (workspace_id, feature_key) DO NOTHING;

COMMIT;
