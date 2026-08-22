-- Secure customer comparison access and single-winner guard for Marketplace Guest Quote offers.
--
-- Sequencing: run after migration 0059.
-- Rollout: additive schema only; verify on isolated Neon Preview before any Production execution.
-- Production execution is intentionally NOT part of this migration commit.
-- Rollback: roll application code back first. The access table can then be retained safely;
-- dropping it or the unique winner index is a deliberate destructive cleanup and must not be automatic.

begin;

create table if not exists marketplace_quote_customer_access (
  quote_request_id uuid primary key references quote_requests(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'sending',
  dispatch_token uuid,
  expires_at timestamptz not null,
  sent_at timestamptz,
  provider_message_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_quote_customer_access_token_check
    check (char_length(token_hash) = 64),
  constraint marketplace_quote_customer_access_status_check
    check (status in ('sending', 'sent', 'delivery_failed')),
  constraint marketplace_quote_customer_access_dispatch_check
    check (status <> 'sending' or dispatch_token is not null)
);

create index if not exists marketplace_quote_customer_access_status_idx
  on marketplace_quote_customer_access (status, updated_at desc);

-- A request can never have two selected Marketplace offers. This is the final
-- database guard under concurrent customer clicks; application logic also locks
-- the Quote Request and rejects the remaining submitted offers atomically.
create unique index if not exists marketplace_quote_offers_one_selected_per_quote_idx
  on marketplace_quote_offers (quote_request_id)
  where status = 'selected';

comment on table marketplace_quote_customer_access is
  'Private hashed-token access for a customer to compare Marketplace offers. Raw tokens are never persisted.';
comment on column marketplace_quote_customer_access.token_hash is
  'SHA-256 hash of the customer comparison token; the raw token exists only in the delivered customer link.';

commit;
