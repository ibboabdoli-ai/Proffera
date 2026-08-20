-- Keep marketplace guest access fail-closed after an invitation has been issued.
--
-- Production forward deployment order: apply 0049, then 0050, then this migration
-- before deploying the marketplace guest application changes. Production is not
-- changed by committing this file.
--
-- This migration adds two safety properties:
-- 1. If a directory profile becomes unpublished, inactive, privacy-blocked,
--    non-juridical, or claimed, active guest links are revoked immediately and
--    offer/dispatch writes re-check the same profile eligibility under row lock.
-- 2. A provider-claimed delivery whose outcome is ambiguous is moved to
--    `delivery_uncertain`. Its guest-token hash and dispatch token are preserved;
--    blind retries with a new provider idempotency key are refused until a future
--    reconciliation flow explicitly resolves the attempt.
--
-- Rollback: roll application code back first. If this migration must then be
-- reversed, remove the profile-revocation and ambiguous-dispatch triggers,
-- restore the 0050 outreach function and 0049 offer-eligibility function, and
-- only then narrow the status check after confirming no `delivery_uncertain`
-- rows remain. Never restore revoked token hashes from backups without a manual
-- privacy review.

begin;

alter table marketplace_quote_invitations
  drop constraint if exists marketplace_quote_invitations_status_check;

alter table marketplace_quote_invitations
  add constraint marketplace_quote_invitations_status_check
  check (status in (
    'pending', 'sending', 'sent', 'viewed', 'responded', 'declined',
    'suppressed', 'delivery_failed', 'delivery_uncertain', 'expired', 'cancelled'
  ));

-- Any pre-existing provider-claimed failure is ambiguous because the application
-- cannot prove that Brevo did not accept the request before the response failed.
update marketplace_quote_invitations
set status = 'delivery_uncertain', updated_at = now()
where status = 'delivery_failed'
  and dispatch_token is not null;

create or replace function guard_marketplace_ambiguous_dispatch_retry()
returns trigger
language plpgsql
as $$
begin
  -- A pending row means provider dispatch was already claimed. If it becomes
  -- stale, do not mint a new idempotency key: preserve the original identity and
  -- require reconciliation instead of risking a duplicate email.
  if old.status = 'pending'
     and old.dispatch_token is not null
     and old.updated_at <= now() - interval '5 minutes'
     and new.status = 'sending'
     and new.dispatch_token is distinct from old.dispatch_token then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    new.expires_at := old.expires_at;
    return new;
  end if;

  -- Delivery failures after a provider claim are ambiguous. Keep the original
  -- guest link/idempotency key and make the row non-retryable until reconciled.
  if old.status = 'pending'
     and old.dispatch_token is not null
     and new.status = 'delivery_failed' then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    return new;
  end if;

  if old.status in ('delivery_failed', 'delivery_uncertain')
     and old.dispatch_token is not null
     and new.status = 'sending' then
    new.status := 'delivery_uncertain';
    new.token_hash := old.token_hash;
    new.dispatch_token := old.dispatch_token;
    new.expires_at := old.expires_at;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_quote_invitation_ambiguous_dispatch_guard_trigger
  on marketplace_quote_invitations;
create trigger marketplace_quote_invitation_ambiguous_dispatch_guard_trigger
before update of status, token_hash, dispatch_token
on marketplace_quote_invitations
for each row
execute function guard_marketplace_ambiguous_dispatch_retry();

create or replace function revoke_marketplace_guest_access_for_ineligible_profile()
returns trigger
language plpgsql
as $$
begin
  if new.publication_status <> 'published'
     or new.is_active is not true
     or new.privacy_blocked is true
     or new.organization_kind <> 'juridical_person'
     or new.claimed_workspace_id is not null then
    update marketplace_quote_invitations invitation
       set status = 'cancelled',
           token_hash = encode(digest(invitation.id::text || ':' || gen_random_uuid()::text, 'sha256'), 'hex'),
           dispatch_token = null,
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
after update of publication_status, is_active, privacy_blocked, organization_kind, claimed_workspace_id
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

-- Recheck profile eligibility on every provider dispatch claim. Row-locking the
-- profile makes a concurrent eligibility change serialize with this decision.
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

  return new;
end;
$$;

comment on function enforce_marketplace_quote_invitation_outreach() is
  'Serializes provider dispatch with opt-out and rechecks quote consent/status plus current directory-profile eligibility.';

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
  'Accepts a guest offer only while invitation, quote, suppression, and current directory-profile eligibility all remain valid.';

commit;
