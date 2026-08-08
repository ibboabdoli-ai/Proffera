begin;

create table if not exists workspace_ai_chat_integrations (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  remote_tenant_id text not null unique,
  remote_client_id text not null unique,
  lifecycle_state text not null check (lifecycle_state in ('active', 'suspended')),
  last_synced_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_ai_chat_integrations_lifecycle_idx
  on workspace_ai_chat_integrations (lifecycle_state, updated_at desc);

commit;
