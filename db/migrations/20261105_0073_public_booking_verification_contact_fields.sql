-- The public-booking verification writer stores address, postcode and
-- booking details, but the canonical table migration lacked these columns.
-- Rollout: apply this additive, idempotent migration and verify success in an
-- isolated Preview database BEFORE deploying any writer that requires the
-- columns. A Production rollout requires separate authorization, a controlled
-- migration window and verification that the schema is ready before traffic.
-- ADD COLUMN takes ACCESS EXCLUSIVE even without defaults. Limit both the
-- lock wait (5 seconds) and execution (30 seconds); timeout means fail closed
-- and retry the migration later, not bypass verification or booking checks.
-- Rollback: revert dependent application code first. Keep the nullable columns
-- in place; dropping them is unnecessary and may discard booking details.
-- Existing verification holds, bookings and payments are not altered.
--
-- A single DO statement applies timeouts transaction-locally immediately
-- before ALTER. This is safe even if a migration runner splits SQL statements.
-- Local timeout settings revert at transaction end, including failed runs.
DO $migration$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '30s', true);
  EXECUTE 'ALTER TABLE public_booking_verifications
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS postcode text,
    ADD COLUMN IF NOT EXISTS booking_details text';
END
$migration$;
