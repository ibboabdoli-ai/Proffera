-- Phase 18.3 seed: safe demo CRM/booking data for Proffera
-- Purpose:
-- - Create one demo customer
-- - Create one demo booking connected to that customer
-- - Create one demo customer event connected to both
--
-- Safety:
-- - Uses fixed UUIDs, so repeated runs update the same demo records instead of creating duplicates.
-- - Uses source = 'demo_seed' for easy identification.
-- - Does not touch quote_requests, company_registrations, or lead_outbox.

BEGIN;

INSERT INTO customers (
  id,
  workspace_id,
  name,
  email,
  phone,
  customer_type,
  city,
  status,
  source,
  primary_service_category_slug,
  primary_service_slug,
  notes
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'default',
  'Demo Kund – Sara Andersson',
  'demo.customer@proffera.se',
  '+46700000001',
  'private',
  'Södertälje',
  'active',
  'demo_seed',
  'stadning-lokalvard',
  'hemstadning',
  'Demo customer created for Phase 18 dashboard read-only CRM testing.'
)
ON CONFLICT (id) DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  customer_type = EXCLUDED.customer_type,
  city = EXCLUDED.city,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  primary_service_category_slug = EXCLUDED.primary_service_category_slug,
  primary_service_slug = EXCLUDED.primary_service_slug,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO bookings (
  id,
  workspace_id,
  customer_id,
  title,
  service,
  service_category_slug,
  service_slug,
  city,
  status,
  starts_at,
  ends_at,
  source,
  notes
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'default',
  '11111111-1111-4111-8111-111111111111',
  'Demo booking – Hemstädning',
  'Hemstädning',
  'stadning-lokalvard',
  'hemstadning',
  'Södertälje',
  'confirmed',
  now() + interval '2 days',
  now() + interval '2 days 2 hours',
  'demo_seed',
  'Demo booking created for Phase 18 dashboard read-only booking testing.'
)
ON CONFLICT (id) DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  customer_id = EXCLUDED.customer_id,
  title = EXCLUDED.title,
  service = EXCLUDED.service,
  service_category_slug = EXCLUDED.service_category_slug,
  service_slug = EXCLUDED.service_slug,
  city = EXCLUDED.city,
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO customer_events (
  id,
  workspace_id,
  customer_id,
  booking_id,
  event_type,
  title,
  description,
  metadata
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'default',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'booking',
  'Demo event – booking confirmed',
  'Demo event created for Phase 18 dashboard customer history testing.',
  '{"source":"demo_seed","phase":"18.3","service_slug":"hemstadning"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  workspace_id = EXCLUDED.workspace_id,
  customer_id = EXCLUDED.customer_id,
  booking_id = EXCLUDED.booking_id,
  event_type = EXCLUDED.event_type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

COMMIT;
