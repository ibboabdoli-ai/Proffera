-- Maria-only booking start closures. Schema-only: no existing booking or customer rows are modified.
-- Deployment/application remains Preview-only until separately approved.
CREATE TABLE IF NOT EXISTS maria_manual_closed_starts (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maria_manual_closed_starts_pk PRIMARY KEY (workspace_id, starts_at)
);
