-- Versioned offers for direct workspace quote requests.
-- Amounts are stored in the workspace billing currency minor unit.

create table if not exists workspace_quote_offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  quote_request_id uuid not null references workspace_quote_requests(id) on delete cascade,
  version integer not null,
  status text not null default 'draft',
  currency text not null,
  subtotal_minor bigint not null,
  vat_rate_basis_points integer not null default 0,
  vat_amount_minor bigint not null,
  total_minor bigint not null,
  title text not null default '',
  terms text not null default '',
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_quote_offers_status_check
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'void')),
  constraint workspace_quote_offers_currency_check
    check (currency in ('SEK', 'EUR', 'GBP')),
  constraint workspace_quote_offers_amounts_check
    check (
      subtotal_minor >= 0
      and vat_rate_basis_points between 0 and 10000
      and vat_amount_minor >= 0
      and total_minor = subtotal_minor + vat_amount_minor
    ),
  constraint workspace_quote_offers_version_check
    check (version >= 1),
  constraint workspace_quote_offers_workspace_request_version_unique
    unique (workspace_id, quote_request_id, version)
);

create index if not exists workspace_quote_offers_workspace_request_idx
  on workspace_quote_offers (workspace_id, quote_request_id, version desc);

create index if not exists workspace_quote_offers_workspace_status_idx
  on workspace_quote_offers (workspace_id, status, updated_at desc);

comment on table workspace_quote_offers is
  'Versioned commercial offers owned by one workspace and attached to a direct workspace quote request.';
