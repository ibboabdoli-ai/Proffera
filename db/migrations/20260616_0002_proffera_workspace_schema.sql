-- P22G: Proffera workspace schema migration candidate.
-- Status: reviewed in code only; do not apply to production until explicitly approved.
-- Scope: Proffera-owned workspace, membership, plan, and feature-flag tables.
-- Non-goals: no Better Auth table changes, no CRM/booking data migration, no runtime auth changes.

BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  company_name text,
  primary_city text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_status_check
    CHECK (status IN ('active', 'trial', 'paused', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique_idx
  ON workspaces (slug);

CREATE INDEX IF NOT EXISTS workspaces_status_idx
  ON workspaces (status);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_memberships_role_check
    CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  CONSTRAINT workspace_memberships_workspace_user_unique
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_memberships_workspace_id_idx
  ON workspace_memberships (workspace_id);

CREATE INDEX IF NOT EXISTS workspace_memberships_user_id_idx
  ON workspace_memberships (user_id);

CREATE TABLE IF NOT EXISTS workspace_plans (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  status text NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_plans_plan_key_check
    CHECK (plan_key IN ('starter', 'professional', 'business')),
  CONSTRAINT workspace_plans_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused'))
);

CREATE INDEX IF NOT EXISTS workspace_plans_workspace_id_idx
  ON workspace_plans (workspace_id);

CREATE INDEX IF NOT EXISTS workspace_plans_plan_key_idx
  ON workspace_plans (plan_key);

CREATE INDEX IF NOT EXISTS workspace_plans_status_idx
  ON workspace_plans (status);

CREATE TABLE IF NOT EXISTS workspace_feature_flags (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_feature_flags_feature_key_check
    CHECK (feature_key IN (
      'ai_assistant',
      'chat_widget',
      'booking_demo',
      'crm_customers',
      'lead_inbox'
    )),
  CONSTRAINT workspace_feature_flags_workspace_feature_unique
    UNIQUE (workspace_id, feature_key)
);

CREATE INDEX IF NOT EXISTS workspace_feature_flags_workspace_id_idx
  ON workspace_feature_flags (workspace_id);

CREATE INDEX IF NOT EXISTS workspace_feature_flags_feature_key_idx
  ON workspace_feature_flags (feature_key);

COMMIT;
