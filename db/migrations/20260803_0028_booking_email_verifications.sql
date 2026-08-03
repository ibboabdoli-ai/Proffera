create table if not exists public_booking_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  public_booking_slug text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  service_name text not null,
  city text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_booking_verifications_email_check check (customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint public_booking_verifications_attempts_check check (attempts >= 0 and max_attempts between 1 and 10),
  constraint public_booking_verifications_schedule_check check (ends_at > starts_at),
  constraint public_booking_verifications_expiry_check check (expires_at > created_at)
);

create index if not exists public_booking_verifications_workspace_slot_idx
  on public_booking_verifications (workspace_id, starts_at, ends_at)
  where consumed_at is null and verified_at is null;

create index if not exists public_booking_verifications_expiry_idx
  on public_booking_verifications (expires_at)
  where consumed_at is null;

comment on table public_booking_verifications is
  'Short-lived, hash-only email verification challenges for public bookings. A booking is created only after successful verification.';
