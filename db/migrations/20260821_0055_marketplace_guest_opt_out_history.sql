-- Preserve every opt-out credential that has already been delivered before an
-- invitation row is reused with a new guest token. This keeps old unsubscribe
-- links valid without keeping old quote-access tokens valid.
--
-- Production forward order:
-- 0049 -> 0050 -> 0051 -> 0052 -> 0053 -> 0054 -> 0055 -> application deploy.
-- Committing this file does not apply it to Production.
--
-- Rollback: roll the application back first. Only then remove this trigger/table
-- after confirming no historical credentials are still needed for recipient
-- suppression. Dropping the history first would invalidate unsubscribe links
-- that were already sent.

begin;

create table if not exists marketplace_guest_opt_out_credentials (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references marketplace_quote_invitations(id) on delete restrict,
  profile_id uuid not null references company_directory_profiles(id) on delete restrict,
  recipient_email_normalized text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_guest_opt_out_credentials_email_check
    check (
      char_length(recipient_email_normalized) between 5 and 320
      and recipient_email_normalized = lower(btrim(recipient_email_normalized))
    ),
  constraint marketplace_guest_opt_out_credentials_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

comment on table marketplace_guest_opt_out_credentials is
  'Historical hashes for opt-out links that were already emailed. Quote-access tokens remain independently revocable.';

create or replace function preserve_marketplace_guest_opt_out_credential()
returns trigger
language plpgsql
as $$
begin
  -- If an address changes, require a new opt-out credential in the same write so
  -- one raw link can never ambiguously refer to two different email addresses.
  if lower(btrim(new.recipient_email)) is distinct from lower(btrim(old.recipient_email))
     and new.opt_out_token_hash is not distinct from old.opt_out_token_hash then
    raise exception using
      errcode = '23514',
      message = 'marketplace_opt_out_token_rotation_required';
  end if;

  if old.opt_out_token_hash is not null
     and new.opt_out_token_hash is distinct from old.opt_out_token_hash then
    insert into marketplace_guest_opt_out_credentials (
      invitation_id,
      profile_id,
      recipient_email_normalized,
      token_hash
    ) values (
      old.id,
      old.profile_id,
      lower(btrim(old.recipient_email)),
      old.opt_out_token_hash
    )
    on conflict (token_hash) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_opt_out_history_trigger
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_opt_out_history_trigger
before update of recipient_email, opt_out_token_hash
on marketplace_quote_invitations
for each row
execute function preserve_marketplace_guest_opt_out_credential();

commit;
