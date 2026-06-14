-- Phase 18.16A workspace services

create table if not exists workspace_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  category text not null default '',
  price_label text not null default '',
  base_price_sek integer,
  duration_minutes integer,
  service_area text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_services_workspace_name_unique unique (workspace_id, name)
);

create index if not exists idx_workspace_services_workspace_id on workspace_services (workspace_id);
create index if not exists idx_workspace_services_active on workspace_services (workspace_id, is_active, sort_order);
