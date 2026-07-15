-- Prepared public-booking availability foundation. Do not run automatically.

BEGIN;

CREATE TABLE IF NOT EXISTS workspace_booking_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_booking_hours_unique UNIQUE (workspace_id, weekday),
  CONSTRAINT workspace_booking_hours_range CHECK (
    is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
  )
);

CREATE INDEX IF NOT EXISTS workspace_booking_hours_workspace_idx
  ON workspace_booking_hours (workspace_id, weekday);

COMMIT;
