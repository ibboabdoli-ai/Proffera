-- Final transactional database hardening for marketplace guest invitations.
--
-- Production forward deployment order: apply 0049, 0050, 0051, then this
-- migration, then apply 0053 without a wrapping transaction, then 0054 status
-- validation before deploying the final marketplace guest application changes.
-- Committing these files does not apply them to Production.
--
-- The normalized recipient index replacement intentionally lives in 0053 so it
-- can use CREATE/DROP INDEX CONCURRENTLY without holding a long table lock.

begin;

-- A live sending/pending attempt owns its provider dispatch token. Do not allow
-- another writer to replace that ownership identity while the attempt remains
-- active. A stale pre-provider `sending` reservation may be reclaimed. A stale
-- provider-claimed `pending` row is allowed through this guard only so the 0051
-- ambiguous-delivery trigger can convert it to `delivery_uncertain` while
-- preserving the original provider identity instead of sending again.
create or replace function guard_marketplace_active_dispatch_token()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('sending', 'pending')
     and old.updated_at <= now() - interval '5 minutes'
     and new.status = 'sending' then
    return new;
  end if;

  if old.status in ('sending', 'pending')
     and new.status in ('sending', 'pending')
     and old.dispatch_token is not null
     and new.dispatch_token is distinct from old.dispatch_token then
    raise exception using
      errcode = '23514',
      message = 'marketplace_active_dispatch_token_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_active_dispatch_token_guard_trigger
  on marketplace_quote_invitations;
drop trigger if exists marketplace_quote_invitation_active_dispatch_token_guard
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_active_dispatch_token_guard
before update of status, dispatch_token
on marketplace_quote_invitations
for each row
execute function guard_marketplace_active_dispatch_token();

comment on function guard_marketplace_active_dispatch_token() is
  'Prevents mutation of provider dispatch ownership while an invitation attempt is active, except safe stale reservation handling governed by 0051.';

-- Staleness is security-sensitive because it decides when a sending reservation
-- can be reclaimed. Make updated_at authoritative in PostgreSQL so every update,
-- including a future writer that forgets the timestamp, refreshes it.
create or replace function touch_marketplace_quote_invitation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_z_touch_updated_at
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_z_touch_updated_at
before update on marketplace_quote_invitations
for each row
execute function touch_marketplace_quote_invitation_updated_at();

comment on function touch_marketplace_quote_invitation_updated_at() is
  'Makes marketplace invitation updated_at database-authoritative. The z-prefixed trigger runs after the dispatch guard triggers.';

commit;