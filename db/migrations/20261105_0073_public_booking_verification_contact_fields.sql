-- The public-booking verification writer stores address, postcode and
-- booking details, but the canonical table migration lacked these columns.
-- Rollout: apply this additive, idempotent migration and verify success in an
-- isolated Preview database BEFORE deploying any writer that requires the
-- columns. Production requires separate authorization, a controlled migration
-- window and verification that the schema is ready before traffic.
-- ADD COLUMN takes ACCESS EXCLUSIVE even without defaults. Arm a 5-second lock
-- wait and a 30-second statement limit BEFORE the ALTER TABLE command starts.
-- Both SET statements and the ALTER must execute sequentially on the SAME
-- database connection, including in runners that split SQL into statements.
-- Timeout means fail closed and retry after contention clears; never bypass
-- booking verification or publish dependent code before migration success.
-- Rollback: revert dependent application code first. Keep these nullable
-- columns in place; dropping them may discard booking details.
-- Existing verification holds, bookings and payments remain untouched.
-- On failure the migration runner must roll back or discard its connection:
-- session-level timeouts are otherwise intentionally left restrictive.
SET statement_timeout = '30s';
SET lock_timeout = '5s';

ALTER TABLE public_booking_verifications
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS booking_details text;

RESET lock_timeout;
RESET statement_timeout;
