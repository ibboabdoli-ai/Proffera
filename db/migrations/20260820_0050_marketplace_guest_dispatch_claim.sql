-- Harden the guest-invitation provider dispatch claim introduced by migration 0049.
--
-- `sending` is the pre-provider reservation. Immediately before the Brevo call,
-- the application transitions the row to `pending`. Both states must take the
-- same normalized-email advisory lock as a permanent suppression so either:
--   1. opt-out commits first and the provider claim fails closed, or
--   2. provider dispatch is already claimed and opt-out is recorded while the UI
--      reports that one already-started delivery may still complete.
--
-- Production forward deployment order: apply this migration before deploying
-- the marketplace-guest-quote.ts application changes that perform the
-- `sending` -> `pending` provider-dispatch claim. This ensures claim
-- serialization is active before the application can enter the pending state.
--
-- Production rollback note: roll application code back first, then restore the
-- 0049 function definition (guarding `sending` only) if this migration itself
-- must be reversed. Do not remove suppression rows as part of that rollback.

begin;

create or replace function enforce_marketplace_quote_invitation_outreach()
returns trigger
language plpgsql
as $$
declare
  normalized_email text;
  request_status text;
  request_consent boolean;
begin
  if new.status not in ('sending', 'pending') then
    return new;
  end if;

  normalized_email := lower(btrim(new.recipient_email));
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  select status, consent_accepted
    into request_status, request_consent
    from quote_requests
   where id = new.quote_request_id
   for update;

  if request_status is null
     or request_status not in ('submitted', 'pending_review', 'approved', 'matched', 'answered') then
    raise exception using errcode = '23514', message = 'marketplace_quote_closed';
  end if;

  if request_consent is not true then
    raise exception using errcode = '23514', message = 'marketplace_consent_required';
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
  'Serializes sending and provider-dispatch claims with permanent recipient suppression and validates quote consent/status.';

commit;
