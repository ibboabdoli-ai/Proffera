-- Secure customer comparison access for Marketplace Guest Quote offers.
--
-- Sequencing: run after migration 0059. The single-winner concurrent unique index
-- is installed separately by migration 0062 after this transaction commits.
-- Rollout: additive schema only; verify on isolated Neon Preview before any Production execution.
-- Production execution is intentionally NOT part of this migration commit.
-- Rollback: roll application code back first. The access table can then be retained safely;
-- dropping it is a deliberate destructive cleanup and must not be automatic.

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

comment on table marketplace_quote_customer_access is
  'Private hashed-token access for a customer to compare Marketplace offers. Raw tokens are never persisted.';
comment on column marketplace_quote_customer_access.token_hash is
  'SHA-256 hash of the customer comparison token; the raw token exists only in the delivered customer link.';

commit;
