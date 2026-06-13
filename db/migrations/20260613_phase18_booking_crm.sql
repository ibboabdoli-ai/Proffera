-- Phase 18.1 — Booking and CRM MVP schema
-- Status: prepared migration file only. Do not run automatically.
-- Purpose: add SaaS CRM/booking tables without touching existing lead flow tables.
-- Protected existing tables: quote_requests, company_registrations, lead_outbox.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  customer_type text NOT NULL DEFAULT 'private' CHECK (customer_type IN ('private', 'company')),
  city text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'paused', 'lost')),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL DEFAULT 'default',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  service text,
  city text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('draft', 'requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  starts_at timestamptz,
  ends_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL DEFAULT 'default',
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('note', 'call', 'email', 'booking', 'status_change', 'ai_conversation')),
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_workspace_status ON customers(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_workspace_status ON bookings(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_id ON customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_booking_id ON customer_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_created_at ON customer_events(created_at);

COMMIT;
