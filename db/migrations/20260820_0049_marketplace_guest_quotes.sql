-- Marketplace guest quote invitations for unclaimed company-directory profiles.
--
-- This keeps marketplace requests separate from direct workspace quote requests.
-- Customer contact data stays in quote_requests and is never copied into the
-- invitation/offer tables exposed to guest companies.
--
-- Production rollback note (manual, destructive; do not execute blindly):
-- 1. Roll application code back first so no requests can read/write these tables.
-- 2. Inspect/export any invitation, offer, suppression, and audit data that must be preserved.
-- 3. Drop the invitation-cap trigger/function, then drop in dependency order:
--    marketplace_outreach_suppressions, marketplace_quote_offers, then
--    marketplace_quote_invitations.
-- 4. Re-check application health and retained audit/data exports before closing the rollback.

create table if not exists marketplace_quote_invitations (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  recipient_email text not null,
  token_hash text not null,
  status text not null default 'pending',
  wave smallint not null default 1,
  match_score smallint not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  contact_basis text not null default 'manual_business_contact',
  expires_at timestamptz not null,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  declined_at timestamptz,
  provider_message_id text not null default '',
  created_by_admin_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_quote_invitations_status_check
    check (status in ('pending', 'sent', 'viewed', 'responded', 'declined', 'suppressed', 'delivery_failed', 'expired', 'cancelled')),
  constraint marketplace_quote_invitations_score_check check (match_score between 0 and 100),
  constraint marketplace_quote_invitations_recipient_check check (char_length(recipient_email) between 5 and 320),
  constraint marketplace_quote_invitations_token_check check (char_length(token_hash) = 64),
  constraint marketplace_quote_invitations_contact_basis_check
    check (contact_basis in ('manual_business_contact', 'official_business_register', 'workspace_contact')),
  constraint marketplace_quote_invitations_quote_profile_unique unique (quote_request_id, profile_id),
  constraint marketplace_quote_invitations_token_unique unique (token_hash)
);

-- The earlier isolated pilot allowed wave values 1..5. The current marketplace
-- model is two outreach batches: the first three invitations are Wave 1 and the
-- next two are Wave 2. For any quote that still contains legacy Wave 3..5 rows,
-- preserve its chronological invitation order, preserve every changed row's
-- original wave value in match_reasons, and explicitly transition the first 3
-- rows to Wave 1 and the next 2 rows to Wave 2. More than five existing
-- invitations cannot be migrated without discarding outreach history, so fail
-- closed and require manual review.
alter table marketplace_quote_invitations
  drop constraint if exists marketplace_quote_invitations_wave_check;

do $$
begin
  if exists (
    select 1
    from marketplace_quote_invitations
    where quote_request_id in (
      select distinct quote_request_id
      from marketplace_quote_invitations
      where wave in (3, 4, 5)
    )
    group by quote_request_id
    having count(*) > 5
  ) then
    raise exception using
      errcode = '23514',
      message = 'marketplace_legacy_invitation_count_exceeds_five';
  end if;
end;
$$;

with affected_quotes as (
  select distinct quote_request_id
  from marketplace_quote_invitations
  where wave in (3, 4, 5)
), ranked as (
  select
    invitation.id,
    invitation.wave as legacy_wave,
    row_number() over (
      partition by invitation.quote_request_id
      order by coalesce(invitation.sent_at, invitation.created_at), invitation.created_at, invitation.id
    ) as invitation_position
  from marketplace_quote_invitations invitation
  join affected_quotes affected
    on affected.quote_request_id = invitation.quote_request_id
), transition as (
  select
    id,
    legacy_wave,
    case when invitation_position <= 3 then 1 else 2 end::smallint as target_wave
  from ranked
)
update marketplace_quote_invitations invitation
set
  wave = transition.target_wave,
  match_reasons =
    (case
      when jsonb_typeof(invitation.match_reasons) = 'array' then invitation.match_reasons
      else '[]'::jsonb
    end) || jsonb_build_array('migration_0049_legacy_wave_' || invitation.wave::text),
  updated_at = now()
from transition
where invitation.id = transition.id
  and invitation.wave <> transition.target_wave;

alter table marketplace_quote_invitations
  add constraint marketplace_quote_invitations_wave_check check (wave in (1, 2));

-- Offers copy quote_request_id/profile_id for efficient querying. This composite
-- key lets PostgreSQL prove those copied identifiers always belong to the same
-- invitation instead of merely existing independently.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'marketplace_quote_invitations'::regclass
      and conname = 'marketplace_quote_invitations_identity_unique'
  ) then
    alter table marketplace_quote_invitations
      add constraint marketplace_quote_invitations_identity_unique
      unique (id, quote_request_id, profile_id);
  end if;
end;
$$;

create index if not exists marketplace_quote_invitations_quote_idx
  on marketplace_quote_invitations (quote_request_id, status, created_at desc);
create index if not exists marketplace_quote_invitations_profile_idx
  on marketplace_quote_invitations (profile_id, status, created_at desc);
create index if not exists marketplace_quote_invitations_recipient_idx
  on marketplace_quote_invitations (lower(recipient_email), status, created_at desc);

create table if not exists marketplace_quote_offers (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references marketplace_quote_invitations(id) on delete cascade,
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  status text not null default 'submitted',
  price_kind text not null,
  currency text not null default 'SEK',
  amount_minor bigint not null default 0,
  available_date date,
  company_note text not null default '',
  submitted_at timestamptz not null default now(),
  selected_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_quote_offers_status_check
    check (status in ('submitted', 'selected', 'rejected', 'withdrawn')),
  constraint marketplace_quote_offers_price_kind_check
    check (price_kind in ('fixed', 'estimate', 'inspection_required')),
  constraint marketplace_quote_offers_currency_check check (currency in ('SEK', 'EUR', 'GBP')),
  constraint marketplace_quote_offers_amount_check check (amount_minor >= 0 and amount_minor <= 1000000000),
  constraint marketplace_quote_offers_note_check check (char_length(company_note) <= 4000)
);

-- Existing pilot data must already agree with its invitation before the
-- composite FK can be installed. Refuse the migration rather than silently
-- rewriting an offer onto another request/profile.
do $$
begin
  if exists (
    select 1
    from marketplace_quote_offers offer
    join marketplace_quote_invitations invitation on invitation.id = offer.invitation_id
    where offer.quote_request_id <> invitation.quote_request_id
       or offer.profile_id <> invitation.profile_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'marketplace_offer_invitation_identity_mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'marketplace_quote_offers'::regclass
      and conname = 'marketplace_quote_offers_invitation_identity_fkey'
  ) then
    alter table marketplace_quote_offers
      add constraint marketplace_quote_offers_invitation_identity_fkey
      foreign key (invitation_id, quote_request_id, profile_id)
      references marketplace_quote_invitations (id, quote_request_id, profile_id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists marketplace_quote_offers_quote_idx
  on marketplace_quote_offers (quote_request_id, status, submitted_at desc);
create index if not exists marketplace_quote_offers_profile_idx
  on marketplace_quote_offers (profile_id, status, submitted_at desc);

create table if not exists marketplace_outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references company_directory_profiles(id) on delete set null,
  email_normalized text not null,
  reason text not null default 'recipient_opt_out',
  source_invitation_id uuid references marketplace_quote_invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint marketplace_outreach_suppressions_email_check check (char_length(email_normalized) between 5 and 320),
  constraint marketplace_outreach_suppressions_email_normalized_check
    check (email_normalized = lower(btrim(email_normalized))),
  constraint marketplace_outreach_suppressions_reason_check check (char_length(reason) between 1 and 200),
  constraint marketplace_outreach_suppressions_email_unique unique (email_normalized)
);

-- The old pilot table predates the normalization constraint. Add it explicitly
-- when upgrading an existing isolated branch as well as when creating clean.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'marketplace_outreach_suppressions'::regclass
      and conname = 'marketplace_outreach_suppressions_email_normalized_check'
  ) then
    alter table marketplace_outreach_suppressions
      add constraint marketplace_outreach_suppressions_email_normalized_check
      check (email_normalized = lower(btrim(email_normalized)));
  end if;
end;
$$;

create index if not exists marketplace_outreach_suppressions_profile_idx
  on marketplace_outreach_suppressions (profile_id, created_at desc)
  where profile_id is not null;

-- Enforce Wave 1 <= 3, Wave 2 <= 2, and <= 5 unique invited profiles per
-- quote request at the database boundary. The transaction-scoped advisory
-- lock serializes concurrent inserts for the same quote request, so two
-- simultaneous admin requests cannot both observe a free final slot.
create or replace function enforce_marketplace_quote_invitation_caps()
returns trigger
language plpgsql
as $$
declare
  wave_limit integer;
  wave_count integer;
  total_count integer;
begin
  if new.wave not in (1, 2) then
    raise exception using errcode = '23514', message = 'marketplace_invalid_wave';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.quote_request_id::text, 0));

  wave_limit := case new.wave when 1 then 3 when 2 then 2 else 0 end;

  select count(*)::integer
    into wave_count
    from marketplace_quote_invitations invitation
   where invitation.quote_request_id = new.quote_request_id
     and invitation.id <> new.id
     and invitation.wave = new.wave;

  select count(*)::integer
    into total_count
    from marketplace_quote_invitations invitation
   where invitation.quote_request_id = new.quote_request_id
     and invitation.id <> new.id;

  if wave_count >= wave_limit or total_count >= 5 then
    raise exception using errcode = '23514', message = 'marketplace_wave_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_caps_trigger
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_caps_trigger
before insert or update of wave, quote_request_id
on marketplace_quote_invitations
for each row
execute function enforce_marketplace_quote_invitation_caps();

comment on table marketplace_quote_invitations is
  'Admin-approved marketplace invitations to companies. Only a token hash is stored; customer contact details remain private in quote_requests.';
comment on table marketplace_quote_offers is
  'Offers submitted against marketplace quote requests by invited companies, including unclaimed directory profiles.';
comment on table marketplace_outreach_suppressions is
  'Permanent marketplace outreach opt-out list. Checked before every guest invitation send and retained if the linked directory profile is removed.';
