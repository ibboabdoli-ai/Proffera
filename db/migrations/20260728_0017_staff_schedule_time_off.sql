create table if not exists workspace_staff_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  staff_id uuid not null references workspace_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_staff_schedules_valid_range check (end_time > start_time),
  constraint workspace_staff_schedules_unique unique (workspace_id, staff_id, weekday, start_time, end_time)
);

create index if not exists idx_workspace_staff_schedules_lookup
  on workspace_staff_schedules (workspace_id, staff_id, weekday, is_active);

create table if not exists workspace_staff_time_off (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  staff_id uuid not null references workspace_staff(id) on delete cascade,
  kind text not null default 'leave' check (kind in ('leave', 'sick', 'break', 'other')),
  reason text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_staff_time_off_valid_range check (ends_at > starts_at)
);

create index if not exists idx_workspace_staff_time_off_lookup
  on workspace_staff_time_off (workspace_id, staff_id, starts_at, ends_at);
