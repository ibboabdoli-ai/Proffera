-- Final database hardening for marketplace guest invitations.
--
-- Production forward deployment order: apply 0049, 0050, 0051, then this
-- migration before deploying the final marketplace guest application changes.
-- Committing this file does not apply it to Production.

begin;

-- Match the normalized recipient expression used by suppression checks and
-- opt-out queries so the lookup remains indexable for whitespace/case variants.
drop index if exists marketplace_quote_invitations_recipient_idx;
create index marketplace_quote_invitations_recipient_idx
  on marketplace_quote_invitations (lower(btrim(recipient_email)), status, created_at desc);

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
create trigger marketplace_quote_invitation_active_dispatch_token_guard_trigger
before update of status, dispatch_token
on marketplace_quote_invitations
for each row
execute function guard_marketplace_active_dispatch_token();

comment on function guard_marketplace_active_dispatch_token() is
  'Prevents mutation of provider dispatch ownership while an invitation attempt is active, except safe stale reservation handling governed by 0051.';

commit;
