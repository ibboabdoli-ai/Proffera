-- The public booking verification writer already stores address and booking
-- details, but the canonical table migration lacked these nullable columns.
-- Additive/idempotent; preserves all existing verification holds and bookings.
ALTER TABLE public_booking_verifications
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS booking_details text;
