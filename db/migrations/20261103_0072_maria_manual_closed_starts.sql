-- Maria-only booking start closures. Schema-only: no existing booking or customer rows are modified.
-- Apply this additive migration to the isolated Preview database BEFORE deploying
-- code that reads or writes maria_manual_closed_starts. Without the table,
-- Maria booking and calendar operations fail closed; never silently bypass it.
-- Production schema rollout requires separate explicit approval and must
-- precede any Production deployment of code depending on this table.
-- Rollback order: first revert ALL dependent readers/writers, then consider
-- dropping the table. DROP TABLE permanently loses all manual closures;
-- preserve/export those rows first if rollback must retain manager decisions.
-- ON DELETE CASCADE intentionally removes closure rows when their owning
-- workspace is deleted; ordinary booking and payment rows are not touched.
-- Deployment/application remains Preview-only until separately approved.
BEGIN;

CREATE TABLE IF NOT EXISTS maria_manual_closed_starts (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maria_manual_closed_starts_pk PRIMARY KEY (workspace_id, starts_at)
);

INSERT INTO proffera_schema_migrations (
  migration_key, filename, checksum, git_sha, applied_by, execution_mode, notes
) VALUES (
  '20261103_0072',
  '20261103_0072_maria_manual_closed_starts.sql',
  null, null, 'migration-0072', 'canonical-migration',
  'Adds isolated Maria manual closed-start table; code rollout requires this table before Preview activation.'
)
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
