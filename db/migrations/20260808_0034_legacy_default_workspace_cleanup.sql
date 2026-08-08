-- Archive and remove pre-Workspace seed rows that used the historical
-- workspace_id='default' sentinel. Production evidence confirmed these five
-- rows were orphaned from bookings/customers/staff/events before cleanup.

create table if not exists legacy_workspace_seed_archive (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_row_id uuid not null,
  original_workspace_id text not null,
  payload jsonb not null,
  reason text not null,
  archived_at timestamptz not null default now(),
  unique (source_table, source_row_id)
);

insert into legacy_workspace_seed_archive (
  source_table,
  source_row_id,
  original_workspace_id,
  payload,
  reason
)
select
  'workspace_settings',
  s.id,
  s.workspace_id,
  to_jsonb(s),
  'Pre-Workspace legacy default seed isolated before tenant hardening.'
from workspace_settings s
where s.workspace_id = 'default'
on conflict (source_table, source_row_id) do nothing;

insert into legacy_workspace_seed_archive (
  source_table,
  source_row_id,
  original_workspace_id,
  payload,
  reason
)
select
  'workspace_services',
  s.id,
  s.workspace_id,
  to_jsonb(s),
  'Pre-Workspace legacy default seed isolated before tenant hardening.'
from workspace_services s
where s.workspace_id = 'default'
on conflict (source_table, source_row_id) do nothing;

delete from workspace_services where workspace_id = 'default';
delete from workspace_settings where workspace_id = 'default';

alter table workspace_services alter column workspace_id drop default;
alter table workspace_settings alter column workspace_id drop default;

alter table workspace_services
  add constraint workspace_services_workspace_id_uuid_shape_check
  check (workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  not valid;
alter table workspace_services
  validate constraint workspace_services_workspace_id_uuid_shape_check;

alter table workspace_settings
  add constraint workspace_settings_workspace_id_uuid_shape_check
  check (workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  not valid;
alter table workspace_settings
  validate constraint workspace_settings_workspace_id_uuid_shape_check;
