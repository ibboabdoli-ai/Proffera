-- Maria-only, immutable, short booking payment references.
-- This additive migration does not update or renumber existing bookings.
-- Production rollout REQUIRES separate explicit authorization and a DB backup.
-- Apply this migration BEFORE deploying readers/writers of the new tables.
-- ROLLBACK: after real reservations, retain BOTH reference tables permanently.
-- Do not drop them or reset counters: customers may already hold short Swish
-- messages in email and QR. Fix errors with additive forward migrations; roll
-- back only application code while retaining stored payment references.
-- ON DELETE CASCADE removes the mapping when a booking itself is deleted; never
-- remove historical customer bookings to simplify rollback.
-- Readers (Swish page, QR endpoint, status email and dashboard) fail closed if
-- these tables are absent, including for existing confirmed bookings. This
-- dependency requires migration-first deployment and a tested rollback plan.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS maria_booking_reference_counters (
  day_key text PRIMARY KEY CHECK (day_key ~ '^[0-9]{8}$'),
  last_number bigint NOT NULL CHECK (last_number BETWEEN 1 AND 999999999)
);

CREATE TABLE IF NOT EXISTS maria_booking_references (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  day_key text NOT NULL REFERENCES maria_booking_reference_counters(day_key),
  day_number bigint NOT NULL CHECK (day_number BETWEEN 1 AND 999999999),
  reference text NOT NULL UNIQUE CHECK (reference ~ '^MBM-[0-9]{10,}$'),
  CONSTRAINT maria_booking_reference_day_number_key UNIQUE (day_key, day_number)
);

-- A pre-existing table with an incompatible shape must NOT receive a migration receipt.
DO $maria0076$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='maria_booking_reference_counters'
          AND column_name IN ('day_key','last_number') AND is_nullable='NO') <> 2
     OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='maria_booking_references'
          AND column_name IN ('booking_id','day_key','day_number','reference')
          AND is_nullable='NO') <> 4
     OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='maria_booking_reference_counters'
          AND ((column_name='day_key' AND udt_name='text')
            OR (column_name='last_number' AND udt_name='int8'))) <> 2
     OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='maria_booking_references'
          AND ((column_name='booking_id' AND udt_name='uuid')
            OR (column_name='day_key' AND udt_name='text')
            OR (column_name='day_number' AND udt_name='int8')
            OR (column_name='reference' AND udt_name='text'))) <> 4
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_reference_counters'::regclass
          AND contype='p' AND conname='maria_booking_reference_counters_pkey')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_references'::regclass
          AND contype='p' AND conname='maria_booking_references_pkey')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_references'::regclass
          AND contype='u' AND conname='maria_booking_references_reference_key')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_references'::regclass
          AND contype='u' AND conname='maria_booking_reference_day_number_key')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_references'::regclass
          AND confrelid='bookings'::regclass AND confdeltype='c'
          AND contype='f' AND conname='maria_booking_references_booking_id_fkey')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='maria_booking_references'::regclass
          AND confrelid='maria_booking_reference_counters'::regclass
          AND contype='f' AND conname='maria_booking_references_day_key_fkey')
  THEN
    RAISE EXCEPTION 'Migration 0076 reference schema mismatch';
  END IF;
END $maria0076$;

INSERT INTO proffera_schema_migrations
 (migration_key,filename,checksum,git_sha,applied_by,execution_mode,notes)
VALUES
 ('20261110_0076','20261110_0076_maria_booking_references.sql',
  null,null,'migration-0076','canonical-migration',
  'Maria-only daily atomic short payment references; existing bookings untouched.')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
