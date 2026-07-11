-- Remove only dashboard records that were explicitly created as demo data.
-- This migration never matches real customer, booking, or event records.

BEGIN;

DELETE FROM customer_events
WHERE metadata->>'source' = 'demo_seed';

DELETE FROM bookings
WHERE source = 'demo_seed';

DELETE FROM customers
WHERE source = 'demo_seed';

COMMIT;
