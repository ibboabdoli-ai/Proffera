create table if not exists workspace_staff (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  role_label text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_staff_workspace_name_unique unique (workspace_id, name)
);

create index if not exists idx_workspace_staff_workspace_active
  on workspace_staff (workspace_id, is_active, sort_order);

alter table bookings
  add column if not exists staff_id uuid references workspace_staff(id) on delete set null;

create index if not exists idx_bookings_workspace_staff_time
  on bookings (workspace_id, staff_id, starts_at)
  where staff_id is not null;
