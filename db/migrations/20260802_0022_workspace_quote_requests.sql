-- Workspace-owned quote inbox for direct business enquiries.
-- This is intentionally separate from the existing global quote_requests table,
-- which remains reserved for the future multi-provider marketplace flow.

create table if not exists workspace_quote_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_id uuid references workspace_services(id) on delete set null,
  reference_id text not null unique,
  status text not null default 'submitted',
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  city text,
  postal_code text,
  description text not null,
  preferred_date text,
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_quote_requests_status_check
    check (status in ('submitted', 'reviewing', 'quoted', 'accepted', 'rejected', 'cancelled')),
  constraint workspace_quote_requests_source_check
    check (source in ('website', 'dashboard', 'api', 'import'))
);

create index if not exists workspace_quote_requests_workspace_created_idx
  on workspace_quote_requests (workspace_id, created_at desc);

create index if not exists workspace_quote_requests_workspace_status_idx
  on workspace_quote_requests (workspace_id, status, created_at desc);

comment on table workspace_quote_requests is
  'Direct quote enquiries owned by one workspace. Separate from the future multi-provider marketplace quote_requests flow.';
