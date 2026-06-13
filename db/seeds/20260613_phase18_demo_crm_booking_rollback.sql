-- Phase 18.3 rollback: remove safe demo CRM/booking data
-- Purpose:
-- - Remove only demo records inserted by db/seeds/20260613_phase18_demo_crm_booking.sql
--
-- Safety:
-- - Uses fixed UUIDs.
-- - Uses source = 'demo_seed' where the table has a source column.
-- - Uses metadata->>'source' = 'demo_seed' for customer_events.
-- - Does not touch quote_requests, company_registrations, or lead_outbox.

BEGIN;

DELETE FROM customer_events
WHERE id = '33333333-3333-4333-8333-333333333333'
  AND metadata->>'source' = 'demo_seed';

DELETE FROM bookings
WHERE id = '22222222-2222-4222-8222-222222222222'
  AND source = 'demo_seed';

DELETE FROM customers
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND source = 'demo_seed';

COMMIT;
