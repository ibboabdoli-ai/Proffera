-- Secure company onboarding invitations.
-- Run after the Better Auth, workspace, and company registration tables exist.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_registration_id uuid NOT NULL REFERENCES company_registrations (id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  workspace_id uuid REFERENCES workspaces (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invitations_registration_unique UNIQUE (company_registration_id),
  CONSTRAINT workspace_invitations_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT workspace_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx
  ON workspace_invitations (lower(email));

CREATE INDEX IF NOT EXISTS workspace_invitations_status_expires_idx
  ON workspace_invitations (status, expires_at);

COMMIT;
