create table if not exists workspace_payment_accounts (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_payment_accounts_ready_idx
  on workspace_payment_accounts (charges_enabled, payouts_enabled, updated_at desc);

comment on table workspace_payment_accounts is
  'Stripe Connect account state for workspace-owned customer payments; separate from Proffera subscription billing.';
