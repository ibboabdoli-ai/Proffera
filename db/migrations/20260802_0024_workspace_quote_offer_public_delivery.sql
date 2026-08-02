-- Secure public delivery for workspace quote offers.
-- Production was applied through Neon migration 507c041b-352a-47db-acc8-9dea3a157250.
-- Only a SHA-256 digest of a customer link token is persisted.

alter table workspace_quote_offers
  add column if not exists public_token_hash text,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists response_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_quote_offers_public_token_hash_check'
      and conrelid = 'workspace_quote_offers'::regclass
  ) then
    alter table workspace_quote_offers
      add constraint workspace_quote_offers_public_token_hash_check
      check (public_token_hash is null or public_token_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

comment on column workspace_quote_offers.public_token_hash is
  'SHA-256 hex digest of the public offer token. The raw token is returned once and never persisted.';

create unique index if not exists workspace_quote_offers_public_token_hash_unique
  on workspace_quote_offers (public_token_hash)
  where public_token_hash is not null;

create index if not exists workspace_quote_offers_public_delivery_idx
  on workspace_quote_offers (public_token_hash, public_token_expires_at)
  where status = 'sent' and public_token_hash is not null;
