-- Secure invitations for people who do not yet have a Proffera account.
BEGIN;

CREATE TABLE IF NOT EXISTS workspace_member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  member_name text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_member_invitations_workspace_email_unique UNIQUE (workspace_id, email),
  CONSTRAINT workspace_member_invitations_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT workspace_member_invitations_role_check CHECK (role IN ('admin', 'staff', 'viewer')),
  CONSTRAINT workspace_member_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX IF NOT EXISTS workspace_member_invitations_pending_idx
  ON workspace_member_invitations (workspace_id, status, expires_at);

COMMIT;
