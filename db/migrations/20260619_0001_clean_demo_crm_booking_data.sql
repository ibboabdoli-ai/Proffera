-- P24K: Clean visible dashboard sample data from the old Phase 18 demo seed.
--
-- Safety:
-- - Updates only fixed UUID records created by db/seeds/20260613_phase18_demo_crm_booking.sql.
-- - Requires source = 'demo_seed' or metadata->>'source' = 'demo_seed'.
-- - Does not delete data.
-- - Does not touch real customers, bookings, quote_requests, company_registrations, or lead_outbox.

BEGIN;

UPDATE customers
SET
  name = 'Sara Andersson',
  email = 'sara.andersson@example.com',
  primary_service_slug = 'Hemstädning',
  notes = 'Seeded customer used for dashboard validation.',
  updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND workspace_id = 'default'
  AND source = 'demo_seed';

UPDATE bookings
SET
  title = 'Hemstädning',
  service = 'Hemstädning',
  notes = 'Seeded booking used for dashboard validation.',
  updated_at = now()
WHERE id = '22222222-2222-4222-8222-222222222222'
  AND workspace_id = 'default'
  AND source = 'demo_seed';

UPDATE customer_events
SET
  title = 'Bokning bekräftad',
  description = 'Seeded customer event used for dashboard validation.',
  metadata = jsonb_set(
    metadata,
    '{service_slug}',
    '"hemstadning"'::jsonb,
    true
  )
WHERE id = '33333333-3333-4333-8333-333333333333'
  AND workspace_id = 'default'
  AND metadata->>'source' = 'demo_seed';

COMMIT;
