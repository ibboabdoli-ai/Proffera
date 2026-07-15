-- Public booking / QR foundation. Prepared only; do not run automatically.
-- Adds a stable public booking slug per workspace and blocks overlapping active bookings.

BEGIN;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS public_booking_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_public_booking_slug_unique_idx
  ON workspaces (public_booking_slug)
  WHERE public_booking_slug IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_active_time_no_overlap
  EXCLUDE USING gist (
    workspace_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show') AND starts_at IS NOT NULL AND ends_at IS NOT NULL)
  DEFERRABLE INITIALLY IMMEDIATE;

COMMIT;
