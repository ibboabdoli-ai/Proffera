create table if not exists workspace_booking_reminder_settings (
  workspace_id text primary key,
  is_enabled boolean not null default true,
  hours_before integer not null default 24 check (hours_before between 1 and 168),
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  booking_id uuid not null references bookings(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  provider_id text,
  error_message text not null default '',
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_reminder_delivery_unique unique (workspace_id, booking_id, channel, scheduled_for)
);

create index if not exists idx_booking_reminder_deliveries_due
  on booking_reminder_deliveries (status, scheduled_for);

create index if not exists idx_booking_reminder_deliveries_workspace
  on booking_reminder_deliveries (workspace_id, created_at desc);
