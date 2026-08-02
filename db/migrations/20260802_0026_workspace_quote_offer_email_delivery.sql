-- Auditable transactional email delivery for workspace quote offers.
-- Customer-link raw tokens are never stored: workspace_quote_offers keeps only
-- the existing SHA-256 token hash and this table records delivery metadata only.

alter table workspace_quote_offers
  add column if not exists email_delivery_attempts integer not null default 0;

alter table workspace_quote_offers
  add constraint workspace_quote_offers_email_delivery_attempts_check
  check (email_delivery_attempts >= 0);

alter table workspace_quote_offers
  add constraint workspace_quote_offers_id_workspace_unique
  unique (id, workspace_id);

create table if not exists workspace_quote_offer_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  quote_offer_id uuid not null,
  attempt integer not null,
  status text not null default 'pending',
  provider_message_id text,
  failure_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint workspace_quote_offer_email_deliveries_offer_workspace_fkey
    foreign key (quote_offer_id, workspace_id)
    references workspace_quote_offers (id, workspace_id)
    on delete cascade,
  constraint workspace_quote_offer_email_deliveries_attempt_check
    check (attempt >= 1),
  constraint workspace_quote_offer_email_deliveries_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint workspace_quote_offer_email_deliveries_failure_code_check
    check (failure_code is null or failure_code in ('configuration', 'provider', 'network', 'rendering', 'superseded')),
  constraint workspace_quote_offer_email_deliveries_resolution_check
    check (
      (status = 'pending' and completed_at is null and provider_message_id is null and failure_code is null)
      or (status = 'sent' and completed_at is not null and failure_code is null)
      or (status = 'failed' and completed_at is not null and provider_message_id is null and failure_code is not null)
    ),
  constraint workspace_quote_offer_email_deliveries_offer_attempt_unique
    unique (workspace_id, quote_offer_id, attempt)
);

create index if not exists workspace_quote_offer_email_deliveries_dashboard_idx
  on workspace_quote_offer_email_deliveries (workspace_id, quote_offer_id, attempt desc);

create unique index if not exists workspace_quote_offer_email_deliveries_one_pending_unique
  on workspace_quote_offer_email_deliveries (workspace_id, quote_offer_id)
  where status = 'pending';

create index if not exists workspace_quote_offer_email_deliveries_pending_idx
  on workspace_quote_offer_email_deliveries (workspace_id, requested_at)
  where status = 'pending';

comment on column workspace_quote_offers.email_delivery_attempts is
  'Monotonic count of generated quote-offer email deliveries. Raw public-link tokens are never stored.';

comment on table workspace_quote_offer_email_deliveries is
  'Workspace-scoped audit for quote-offer email attempts. It stores delivery result metadata, never raw customer-link tokens.';
