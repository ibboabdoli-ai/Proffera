-- Additive, idempotent booking lifecycle columns used by the existing
-- customer portal. No existing booking, service or customer row is changed.
-- This migration is committed for isolated QA; a Production rollout needs
-- separate explicit authorization and the canonical migration preflight.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE workspace_booking_reminder_settings
  ADD COLUMN IF NOT EXISTS customer_reschedule_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_cancel_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancel_notice_hours integer NOT NULL DEFAULT 0 CHECK (cancel_notice_hours BETWEEN 0 AND 720),
  ADD COLUMN IF NOT EXISTS no_show_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_complete_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_confirmation_required boolean NOT NULL DEFAULT true;

INSERT INTO proffera_schema_migrations (
  migration_key, filename, checksum, git_sha, applied_by, execution_mode, notes
) VALUES (
  '20261108_0075',
  '20261108_0075_booking_reminder_lifecycle_settings.sql',
  null, null, 'migration-0075', 'canonical-migration',
  'Adds missing booking reminder lifecycle settings; no backfill, existing booking mutation or public activation.'
)
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
