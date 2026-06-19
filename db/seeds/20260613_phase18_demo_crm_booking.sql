-- Phase 18.3 seed: safe CRM/booking sample data for Proffera
-- Purpose:
-- - Create one customer
-- - Create one booking connected to that customer
-- - Create one customer event connected to both
--
-- Safety:
-- - Uses fixed UUIDs, so repeated runs update the same records instead of creating duplicates.
-- - Uses source = 'demo_seed' for easy identification and safe cleanup.
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
  'Sara Andersson',
  'sara.andersson@example.com',
  '+46700000001',
  'private',
  'Södertälje',
  'active',
  'demo_seed',
  'stadning-lokalvard',
  'Hemstädning',
  'Seeded customer used for dashboard validation.'
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
  'Hemstädning',
  'Hemstädning',
  'stadning-lokalvard',
  'hemstadning',
  'Södertälje',
  'confirmed',
  now() + interval '2 days',
  now() + interval '2 days 2 hours',
  'demo_seed',
  'Seeded booking used for dashboard validation.'
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
  'Bokning bekräftad',
  'Seeded customer event used for dashboard validation.',
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
