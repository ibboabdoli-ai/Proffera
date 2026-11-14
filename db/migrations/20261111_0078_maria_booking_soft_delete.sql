-- Issue #988: reversible Maria booking archive. Schema-only; no Production execution.
-- No DELETE from bookings, customers, Swish, invoices or customer_events.
BEGIN;
CREATE TABLE IF NOT EXISTS booking_soft_deletions (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  deleted_by text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_by text,
  restored_at timestamptz,
  PRIMARY KEY (workspace_id, booking_id)
);
CREATE INDEX IF NOT EXISTS booking_soft_deletions_active_idx
  ON booking_soft_deletions (workspace_id, deleted_at) WHERE restored_at IS NULL;

CREATE TABLE IF NOT EXISTS booking_soft_delete_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('hide','restore')),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_soft_delete_events_history_idx
  ON booking_soft_delete_events (workspace_id, booking_id, created_at);

-- Reconcile canonical shape before writing migration ledger.
DO $check$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='booking_soft_deletions'
        AND column_name IN ('workspace_id','booking_id','deleted_by','deleted_at','restored_by','restored_at')) <> 6
     OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'booking_soft_deletions'::regclass AND contype='p'
        AND pg_get_constraintdef(oid)='PRIMARY KEY (workspace_id, booking_id)'
     )
  THEN RAISE EXCEPTION 'Booking soft deletion schema mismatch'; END IF;
END $check$;

INSERT INTO proffera_schema_migrations
(migration_key, filename, checksum, git_sha, applied_by, execution_mode, notes)
VALUES ('20261111_0078','20261111_0078_maria_booking_soft_delete.sql',
 null,null,'migration-0078','canonical-migration',
 'Reversible owner-only Maria booking archive with immutable audit; no booking/payments deletion')
ON CONFLICT (migration_key) DO NOTHING;
COMMIT;
