create table if not exists workspace_service_job_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_job_id uuid not null references workspace_service_jobs(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, service_job_id)
);

create index if not exists workspace_service_job_payments_status_idx
  on workspace_service_job_payments (workspace_id, status, created_at desc);
