-- Secure public delivery for workspace quote offers.
-- Raw public tokens are never stored; only a SHA-256 hex digest is persisted.

alter table workspace_quote_offers
  add column if not exists public_token_hash text,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists response_at timestamptz;

alter table workspace_quote_offers
  add constraint workspace_quote_offers_public_token_hash_check
  check (public_token_hash is null or public_token_hash ~ '^[0-9a-f]{64}$') not valid;

alter table workspace_quote_offers
  validate constraint workspace_quote_offers_public_token_hash_check;

create unique index if not exists workspace_quote_offers_public_token_hash_unique
  on workspace_quote_offers (public_token_hash)
  where public_token_hash is not null;

create index if not exists workspace_quote_offers_public_delivery_idx
  on workspace_quote_offers (public_token_hash, public_token_expires_at)
  where status = 'sent' and public_token_hash is not null;

comment on column workspace_quote_offers.public_token_hash is
  'SHA-256 hex digest of the public offer token. The raw token is returned once and never persisted.';
