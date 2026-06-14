-- Phase 18.15 workspace settings

create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  company_name text not null default 'Proffera',
  primary_city text not null default 'Stockholm',
  response_time_goal text not null default 'Inom 24 timmar',
  default_cta text not null default 'Boka demo',
  contact_email text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_settings_workspace_unique unique (workspace_id)
);

create index if not exists idx_workspace_settings_workspace_id on workspace_settings (workspace_id);

insert into workspace_settings (
  workspace_id,
  company_name,
  primary_city,
  response_time_goal,
  default_cta,
  contact_email,
  contact_phone
)
values (
  'default',
  'Proffera',
  'Stockholm',
  'Inom 24 timmar',
  'Boka demo',
  '',
  ''
)
on conflict (workspace_id) do nothing;
