-- P24O: Clean remaining visible seeded notes from dashboard sample data.
--
-- Safety:
-- - Updates only fixed UUID records created by db/seeds/20260613_phase18_demo_crm_booking.sql.
-- - Requires source = 'demo_seed' or metadata->>'source' = 'demo_seed'.
-- - Does not delete data.
-- - Does not change schema.
-- - Does not touch real customers, bookings, quote_requests, company_registrations, or lead_outbox.

BEGIN;

UPDATE customers
SET
  notes = 'Kunden är aktiv och kan följas upp vid nästa kontakt.',
  updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND workspace_id = 'default'
  AND source = 'demo_seed';

UPDATE bookings
SET
  notes = 'Bokningen är bekräftad och redo att förberedas.',
  updated_at = now()
WHERE id = '22222222-2222-4222-8222-222222222222'
  AND workspace_id = 'default'
  AND source = 'demo_seed';

UPDATE customer_events
SET
  description = 'Bokningen bekräftades och är klar för nästa steg.'
WHERE id = '33333333-3333-4333-8333-333333333333'
  AND workspace_id = 'default'
  AND metadata->>'source' = 'demo_seed';

COMMIT;
