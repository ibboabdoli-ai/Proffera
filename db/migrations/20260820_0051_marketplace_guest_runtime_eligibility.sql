-- Keep marketplace guest access fail-closed after an invitation has been issued.
--
-- Production forward deployment order: apply 0049, then 0050, then this migration,
-- then 0052 and the non-transactional 0053 index migration before deploying the
-- marketplace guest application changes. Production is not changed by committing
-- this file.
--
-- This migration adds three safety properties:
-- 1. If a directory profile becomes unpublished, inactive, privacy-blocked,
--    non-juridical, or claimed, active guest links are revoked immediately and
--    offer/dispatch writes re-check the same profile eligibility.
-- 2. Provider-claimed delivery is tracked separately from a pre-provider
--    reservation. Only a genuinely claimed/attempted provider delivery can move
--    to `delivery_uncertain`; definite pre-provider failures stay retryable.
-- 3. Profile eligibility changes and guest dispatch/offer checks share a
--    profile-scoped advisory lock so they do not acquire profile/invitation row
--    locks in opposite orders.
--
-- Rollback: roll application code back first. If this migration must then be
-- reversed, remove the profile-revocation and ambiguous-dispatch triggers,
-- restore the 0050 outreach function and 0049 offer-eligibility function, and
-- only then remove provider_claimed_at / narrow the status check after confirming
-- no `delivery_uncertain` rows remain. Never restore revoked token hashes from
-- backups without a manual privacy review.

begin;

alter table marketplace_quote_invitations
  drop constraint if exists marketplace_quote_invitations_status_check;

-- NOT VALID avoids the heavyweight validation scan while installing the widened
-- predicate. It still enforces the predicate for every new/updated row. Validate
-- explicitly after the small state backfills below.
alter table marketplace_quote_invitations
  add constraint marketplace_quote_invitations_status_check
  check (status in (
    'pending', 'sending', 'sent', 'viewed', 'responded', 'declined',
    'suppressed', 'delivery_failed', 'delivery_uncertain', 'expired', 'cancelled'
  )) not valid;

alter table marketplace_quote_invitations
  add column if not exists provider_claimed_at timestamptz;

comment on column marketplace_quote_invitations.provider_claimed_at is
  'Set when a sending reservation is promoted to the provider-claimed pending state immediately before the external delivery attempt.';

-- A pending row created by the 0050 state machine represents a provider claim.
-- Preserve that fact for any in-flight rows present when this migration installs.
-- Do not infer provider contact for delivery_failed rows from dispatch_token alone:
-- a dispatch token exists already in the pre-provider sending reservation.
update marketplace_quote_invitations
set provider_claimed_at = coalesce(provider_claimed_at, updated_at)
where status = 'pending'
  and dispatch_token is not null
  and provider_claimed_at is null;

alter table marketplace_quote_invitations
  validate constraint marketplace_quote_invitations_status_check;

create or replace function guard_marketplace_ambiguous_dispatch_retry()
returns trigger
language plpgsql
as $$
begin
  -- A stale pending row has already crossed the explicit provider-claim boundary.
  -- Do not mint a new provider identity: preserve the original identities and
  -- require reconciliation instead of risking a duplicate email.
  if old.status = 'pending'
     and old.provider_claimed_at is not null
     and old.dispatch_token is not null
     and old.updated_at <= now() - interval '5 minutes'
     and new.status = 'sending'
     and new.dispatch_token is distinct from old.dispatch_token then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    new.provider_claimed_at := old.provider_claimed_at;
    new.expires_at := old.expires_at;
    return new;
  end if;

  -- Delivery failures after a provider claim are ambiguous unless the writer
  -- explicitly clears provider_claimed_at to record a definite pre-provider
  -- failure (for example missing provider configuration).
  if old.status = 'pending'
     and old.provider_claimed_at is not null
     and old.dispatch_token is not null
     and new.status = 'delivery_failed'
     and new.provider_claimed_at is not null then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    new.provider_claimed_at := old.provider_claimed_at;
    return new;
  end if;

  -- A definite pre-provider delivery_failed row has provider_claimed_at = null
  -- and remains retryable. Claimed failures/uncertain attempts stay fail-closed.
  if old.status in ('delivery_failed', 'delivery_uncertain')
     and old.provider_claimed_at is not null
     and old.dispatch_token is not null
     and new.status = 'sending' then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    new.provider_claimed_at := old.provider_claimed_at;
    new.expires_at := old.expires_at;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_ambiguous_dispatch_guard_trigger
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_ambiguous_dispatch_guard_trigger
before update of status, token_hash, dispatch_token, provider_claimed_at
on marketplace_quote_invitations
for each row
execute function guard_marketplace_ambiguous_dispatch_retry();

create or replace function revoke_marketplace_guest_access_for_ineligible_profile()
returns trigger
language plpgsql
as $$
begin
  -- This BEFORE trigger takes the same deterministic lock used by dispatch and
  -- offer eligibility before it touches invitation rows. That removes the
  -- profile-row -> invitation-row / invitation-row -> profile-row inversion.
  perform pg_advisory_xact_lock(
    hashtextextended('marketplace_profile:' || new.id::text, 0)
  );

  if new.publication_status <> 'published'
     or new.is_active is not true
     or new.privacy_blocked is true
     or new.organization_kind <> 'juridical_person'
     or new.claimed_workspace_id is not null then
    update marketplace_quote_invitations invitation
       set status = 'cancelled',
           token_hash = encode(digest(invitation.id::text || ':' || gen_random_uuid()::text, 'sha256'), 'hex'),
           dispatch_token = null,
           provider_claimed_at = null,
           updated_at = now()
     where invitation.profile_id = new.id
       and invitation.status in (
         'pending', 'sending', 'sent', 'viewed', 'delivery_failed', 'delivery_uncertain'
       );
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_profile_guest_access_revocation_trigger
  on company_directory_profiles;
create trigger marketplace_profile_guest_access_revocation_trigger
before update of publication_status, is_active, privacy_blocked, organization_kind, claimed_workspace_id
on company_directory_profiles
for each row
when (
  new.publication_status <> 'published'
  or new.is_active is not true
  or new.privacy_blocked is true
  or new.organization_kind <> 'juridical_person'
  or new.claimed_workspace_id is not null
)
execute function revoke_marketplace_guest_access_for_ineligible_profile();

-- Revoke any active guest links that were already attached to an ineligible
-- profile before this migration was installed.
update marketplace_quote_invitations invitation
   set status = 'cancelled',
       token_hash = encode(digest(invitation.id::text || ':' || gen_random_uuid()::text, 'sha256'), 'hex'),
       dispatch_token = null,
       provider_claimed_at = null,
       updated_at = now()
  from company_directory_profiles profile
 where profile.id = invitation.profile_id
   and (
     profile.publication_status <> 'published'
     or profile.is_active is not true
     or profile.privacy_blocked is true
     or profile.organization_kind <> 'juridical_person'
     or profile.claimed_workspace_id is not null
   )
   and invitation.status in (
     'pending', 'sending', 'sent', 'viewed', 'delivery_failed', 'delivery_uncertain'
   );

-- Recheck profile eligibility on every provider dispatch claim. The profile
-- advisory lock is acquired before the recipient lock and before the row-locking
-- read, matching the revocation trigger's lock order.
create or replace function enforce_marketplace_quote_invitation_outreach()
returns trigger
language plpgsql
as $$
declare
  normalized_email text;
  request_status text;
  request_consent boolean;
  profile_publication_status text;
  profile_is_active boolean;
  profile_privacy_blocked boolean;
  profile_organization_kind text;
  profile_claimed_workspace_id uuid;
begin
  if new.status not in ('sending', 'pending') then
    return new;
  end if;

  if new.dispatch_token is null then
    raise exception using errcode = '23514', message = 'marketplace_dispatch_token_required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('marketplace_profile:' || new.profile_id::text, 0)
  );

  normalized_email := lower(btrim(new.recipient_email));
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  select
    request.status,
    request.consent_accepted,
    profile.publication_status,
    profile.is_active,
    profile.privacy_blocked,
    profile.organization_kind,
    profile.claimed_workspace_id
  into
    request_status,
    request_consent,
    profile_publication_status,
    profile_is_active,
    profile_privacy_blocked,
    profile_organization_kind,
    profile_claimed_workspace_id
  from quote_requests request
  join company_directory_profiles profile on profile.id = new.profile_id
  where request.id = new.quote_request_id
  for update of request, profile;

  if request_status is null
     or request_status not in ('submitted', 'pending_review', 'approved', 'matched', 'answered') then
    raise exception using errcode = '23514', message = 'marketplace_quote_closed';
  end if;

  if request_consent is not true then
    raise exception using errcode = '23514', message = 'marketplace_consent_required';
  end if;

  if profile_publication_status is null
     or profile_publication_status <> 'published'
     or profile_is_active is not true
     or profile_privacy_blocked is true
     or profile_organization_kind <> 'juridical_person'
     or profile_claimed_workspace_id is not null then
    raise exception using errcode = '23514', message = 'marketplace_profile_ineligible';
  end if;

  if exists (
    select 1
    from marketplace_outreach_suppressions suppression
    where suppression.email_normalized = normalized_email
  ) then
    raise exception using errcode = '23514', message = 'marketplace_recipient_suppressed';
  end if;

  -- `pending` is the durable provider-claim boundary. Set the marker in the
  -- database so no caller can forget it.
  if tg_op = 'UPDATE'
     and old.status = 'sending'
     and new.status = 'pending'
     and new.provider_claimed_at is null then
    new.provider_claimed_at := now();
  end if;

  return new;
end;
$$;

comment on function enforce_marketplace_quote_invitation_outreach() is
  'Serializes provider dispatch with opt-out, records the provider-claim boundary, and rechecks quote consent/status plus current directory-profile eligibility.';

-- Recheck the same profile eligibility at offer insertion. This closes the race
-- between rendering a valid guest page and a later directory privacy/status
-- change before the guest submits an offer.
create or replace function enforce_marketplace_quote_offer_eligibility()
returns trigger
language plpgsql
as $$
declare
  normalized_email text;
  invitation_status text;
  invitation_expires_at timestamptz;
  request_status text;
  profile_publication_status text;
  profile_is_active boolean;
  profile_privacy_blocked boolean;
  profile_organization_kind text;
  profile_claimed_workspace_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('marketplace_profile:' || new.profile_id::text, 0)
  );

  select lower(btrim(recipient_email))
    into normalized_email
    from marketplace_quote_invitations
   where id = new.invitation_id;

  if normalized_email is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  select
    invitation.status,
    invitation.expires_at,
    request.status,
    profile.publication_status,
    profile.is_active,
    profile.privacy_blocked,
    profile.organization_kind,
    profile.claimed_workspace_id
  into
    invitation_status,
    invitation_expires_at,
    request_status,
    profile_publication_status,
    profile_is_active,
    profile_privacy_blocked,
    profile_organization_kind,
    profile_claimed_workspace_id
  from marketplace_quote_invitations invitation
  join quote_requests request on request.id = invitation.quote_request_id
  join company_directory_profiles profile on profile.id = invitation.profile_id
  where invitation.id = new.invitation_id
    and invitation.quote_request_id = new.quote_request_id
    and invitation.profile_id = new.profile_id
  for update of invitation, request, profile;

  if invitation_status is null then
    return new;
  end if;

  if invitation_status not in ('pending', 'sending', 'sent', 'viewed')
     or invitation_expires_at <= now()
     or request_status not in ('submitted', 'pending_review', 'approved', 'matched', 'answered') then
    raise exception using errcode = '23514', message = 'marketplace_quote_closed';
  end if;

  if profile_publication_status is null
     or profile_publication_status <> 'published'
     or profile_is_active is not true
     or profile_privacy_blocked is true
     or profile_organization_kind <> 'juridical_person'
     or profile_claimed_workspace_id is not null then
    raise exception using errcode = '23514', message = 'marketplace_profile_ineligible';
  end if;

  if exists (
    select 1
    from marketplace_outreach_suppressions suppression
    where suppression.email_normalized = normalized_email
  ) then
    raise exception using errcode = '23514', message = 'marketplace_recipient_suppressed';
  end if;

  return new;
end;
$$;

comment on function enforce_marketplace_quote_offer_eligibility() is
  'Accepts a guest offer only while invitation, quote, suppression, and current directory-profile eligibility all remain valid under deterministic profile/email locks.';

commit;
