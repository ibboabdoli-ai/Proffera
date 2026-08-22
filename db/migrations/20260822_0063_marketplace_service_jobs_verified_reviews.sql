begin;

-- Marketplace fulfillment stays independent from Workspace ownership so an
-- unclaimed Directory company can complete real Proffera work without a fake
-- tenant. Customer PII remains owned by quote_requests and is not copied here.
create table if not exists marketplace_service_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  selected_offer_id uuid not null references marketplace_quote_offers(id) on delete restrict,
  invitation_id uuid not null references marketplace_quote_invitations(id) on delete restrict,
  profile_id uuid not null references company_directory_profiles(id) on delete restrict,
  workspace_id uuid references workspaces(id) on delete set null,
  status text not null default 'accepted',
  service_name text not null,
  city text not null default '',
  currency text not null default 'SEK',
  amount_minor bigint not null default 0,
  scheduled_date date,
  completion_summary text,
  resolution_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_service_jobs_quote_unique unique (quote_request_id),
  constraint marketplace_service_jobs_offer_unique unique (selected_offer_id),
  constraint marketplace_service_jobs_status_check check (
    status in ('accepted', 'in_progress', 'completed', 'customer_cancelled', 'provider_cancelled', 'no_show', 'problem')
  ),
  constraint marketplace_service_jobs_amount_check check (amount_minor >= 0 and amount_minor <= 1000000000),
  constraint marketplace_service_jobs_currency_check check (currency in ('SEK', 'EUR', 'GBP')),
  constraint marketplace_service_jobs_completion_check check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint marketplace_service_jobs_cancellation_check check (
    (status in ('customer_cancelled', 'provider_cancelled', 'no_show')) = (cancelled_at is not null)
  )
);

create index if not exists marketplace_service_jobs_profile_status_idx
  on marketplace_service_jobs (profile_id, status, updated_at desc);
create index if not exists marketplace_service_jobs_workspace_status_idx
  on marketplace_service_jobs (workspace_id, status, updated_at desc)
  where workspace_id is not null;

create table if not exists marketplace_service_job_events (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references marketplace_service_jobs(id) on delete cascade,
  actor_type text not null,
  event_type text not null,
  from_status text,
  to_status text,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint marketplace_service_job_events_actor_check check (
    actor_type in ('customer', 'provider', 'system', 'admin')
  ),
  constraint marketplace_service_job_events_type_check check (
    event_type in ('created', 'status_changed', 'review_invited', 'review_submitted')
  ),
  constraint marketplace_service_job_events_reason_check check (char_length(reason) <= 1000)
);

create index if not exists marketplace_service_job_events_job_idx
  on marketplace_service_job_events (service_job_id, created_at, id);

-- Validate that a job always points at the selected offer and the same
-- quote/profile/invitation identity. This protects repair/admin paths too.
create or replace function enforce_marketplace_service_job_identity()
returns trigger
language plpgsql
as $$
declare
  offer_quote_id uuid;
  offer_profile_id uuid;
  offer_invitation_id uuid;
  offer_workspace_id uuid;
  offer_status text;
begin
  select quote_request_id, profile_id, invitation_id, workspace_id, status
    into offer_quote_id, offer_profile_id, offer_invitation_id, offer_workspace_id, offer_status
    from marketplace_quote_offers
   where id = new.selected_offer_id
   for key share;

  if offer_status is null
     or offer_status <> 'selected'
     or offer_quote_id <> new.quote_request_id
     or offer_profile_id <> new.profile_id
     or offer_invitation_id <> new.invitation_id
     or offer_workspace_id is distinct from new.workspace_id then
    raise exception using errcode = '23514', message = 'marketplace_service_job_offer_identity_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_service_job_identity_guard_trigger on marketplace_service_jobs;
create trigger marketplace_service_job_identity_guard_trigger
before insert or update of quote_request_id, selected_offer_id, invitation_id, profile_id, workspace_id
on marketplace_service_jobs
for each row execute function enforce_marketplace_service_job_identity();

-- Keep lifecycle transitions explicit. Terminal states cannot silently reopen;
-- a provider cancellation never promotes a losing offer to winner.
create or replace function enforce_marketplace_service_job_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' or new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'accepted' and new.status in ('in_progress', 'customer_cancelled', 'provider_cancelled', 'no_show', 'problem'))
    or (old.status = 'in_progress' and new.status in ('completed', 'customer_cancelled', 'provider_cancelled', 'problem'))
    or (old.status = 'problem' and new.status in ('in_progress', 'completed', 'customer_cancelled', 'provider_cancelled'))
  ) then
    raise exception using errcode = '23514', message = 'marketplace_service_job_invalid_transition';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_service_job_transition_guard_trigger on marketplace_service_jobs;
create trigger marketplace_service_job_transition_guard_trigger
before update of status on marketplace_service_jobs
for each row execute function enforce_marketplace_service_job_transition();

-- Winner selection already owns the atomic customer award transaction. This
-- trigger attaches the fulfillment job to that same transaction without making
-- application deployment depend on migration ordering.
create or replace function create_marketplace_service_job_for_selected_offer()
returns trigger
language plpgsql
as $$
declare
  request_service text;
  request_city text;
begin
  if new.status <> 'selected' or (tg_op = 'UPDATE' and old.status = 'selected') then
    return new;
  end if;

  select service_type, city into request_service, request_city
  from quote_requests where id = new.quote_request_id;

  insert into marketplace_service_jobs (
    quote_request_id,
    selected_offer_id,
    invitation_id,
    profile_id,
    workspace_id,
    status,
    service_name,
    city,
    currency,
    amount_minor,
    scheduled_date
  ) values (
    new.quote_request_id,
    new.id,
    new.invitation_id,
    new.profile_id,
    new.workspace_id,
    'accepted',
    coalesce(nullif(request_service, ''), 'Service'),
    coalesce(request_city, ''),
    new.currency,
    new.amount_minor,
    new.available_date
  )
  on conflict (quote_request_id) do nothing;

  insert into marketplace_service_job_events (service_job_id, actor_type, event_type, to_status, reason)
  select job.id, 'customer', 'created', 'accepted', 'Customer selected Marketplace offer'
  from marketplace_service_jobs job
  where job.quote_request_id = new.quote_request_id
    and job.selected_offer_id = new.id
    and not exists (
      select 1 from marketplace_service_job_events event
      where event.service_job_id = job.id and event.event_type = 'created'
    );

  return new;
end;
$$;

drop trigger if exists marketplace_selected_offer_service_job_trigger on marketplace_quote_offers;
create trigger marketplace_selected_offer_service_job_trigger
after insert or update of status on marketplace_quote_offers
for each row execute function create_marketplace_service_job_for_selected_offer();

-- Extend the central Verified Review system with a Marketplace source. Existing
-- booking/workspace invitations remain byte-for-byte valid and keep their
-- entitlement checks in application code.
alter table website_review_invitations
  add column if not exists marketplace_service_job_id uuid,
  add column if not exists profile_id uuid;

alter table website_review_invitations alter column workspace_id drop not null;
alter table website_review_invitations alter column booking_id drop not null;

alter table website_review_invitations
  drop constraint if exists website_review_invitations_marketplace_service_job_id_fkey;
alter table website_review_invitations
  add constraint website_review_invitations_marketplace_service_job_id_fkey
  foreign key (marketplace_service_job_id) references marketplace_service_jobs(id) on delete cascade;

alter table website_review_invitations
  drop constraint if exists website_review_invitations_profile_id_fkey;
alter table website_review_invitations
  add constraint website_review_invitations_profile_id_fkey
  foreign key (profile_id) references company_directory_profiles(id) on delete cascade;

alter table website_review_invitations
  drop constraint if exists website_review_invitations_source_check;
alter table website_review_invitations
  add constraint website_review_invitations_source_check check (
    (workspace_id is not null and booking_id is not null and marketplace_service_job_id is null and profile_id is null)
    or
    (workspace_id is null and booking_id is null and marketplace_service_job_id is not null and profile_id is not null and customer_id is null)
  );

create unique index if not exists website_review_invitations_marketplace_job_unique_idx
  on website_review_invitations (marketplace_service_job_id)
  where marketplace_service_job_id is not null;
create unique index if not exists website_review_invitations_id_profile_unique_idx
  on website_review_invitations (id, profile_id)
  where profile_id is not null;

alter table website_reviews
  add column if not exists marketplace_service_job_id uuid,
  add column if not exists profile_id uuid;

alter table website_reviews alter column workspace_id drop not null;

alter table website_reviews
  drop constraint if exists website_reviews_marketplace_service_job_id_fkey;
alter table website_reviews
  add constraint website_reviews_marketplace_service_job_id_fkey
  foreign key (marketplace_service_job_id) references marketplace_service_jobs(id) on delete set null;

alter table website_reviews
  drop constraint if exists website_reviews_profile_id_fkey;
alter table website_reviews
  add constraint website_reviews_profile_id_fkey
  foreign key (profile_id) references company_directory_profiles(id) on delete cascade;

alter table website_reviews
  drop constraint if exists website_reviews_source_check;
alter table website_reviews
  add constraint website_reviews_source_check check (
    (workspace_id is not null and marketplace_service_job_id is null and profile_id is null)
    or
    (workspace_id is null and marketplace_service_job_id is not null and profile_id is not null and booking_id is null and customer_id is null and review_invitation_id is not null)
  );

create unique index if not exists website_reviews_marketplace_job_verified_unique_idx
  on website_reviews (marketplace_service_job_id)
  where marketplace_service_job_id is not null and is_verified = true;

-- Marketplace reviews must come from the invitation for the same completed job
-- and profile. Workspace reviews keep the existing tenant FK path.
create or replace function enforce_marketplace_verified_review_identity()
returns trigger
language plpgsql
as $$
declare
  invitation_job_id uuid;
  invitation_profile_id uuid;
begin
  if new.marketplace_service_job_id is null then
    return new;
  end if;

  select marketplace_service_job_id, profile_id
    into invitation_job_id, invitation_profile_id
    from website_review_invitations
   where id = new.review_invitation_id
   for key share;

  if invitation_job_id is null
     or invitation_job_id <> new.marketplace_service_job_id
     or invitation_profile_id <> new.profile_id then
    raise exception using errcode = '23514', message = 'marketplace_verified_review_invitation_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_verified_review_identity_guard_trigger on website_reviews;
create trigger marketplace_verified_review_identity_guard_trigger
before insert or update of review_invitation_id, marketplace_service_job_id, profile_id
on website_reviews
for each row execute function enforce_marketplace_verified_review_identity();

create or replace view marketplace_profile_reputation as
select
  profile.id as profile_id,
  count(job.id) filter (where job.status = 'completed')::int as completed_jobs,
  count(job.id) filter (where job.status = 'provider_cancelled')::int as provider_cancelled_jobs,
  count(job.id) filter (where job.status = 'customer_cancelled')::int as customer_cancelled_jobs,
  count(job.id) filter (where job.status = 'no_show')::int as no_show_jobs,
  count(job.id) filter (where job.status = 'problem')::int as problem_jobs,
  coalesce(review_stats.review_count, 0)::int as verified_review_count,
  review_stats.rating
from company_directory_profiles profile
left join marketplace_service_jobs job on job.profile_id = profile.id
left join lateral (
  select
    count(*)::int as review_count,
    round(avg(review.rating)::numeric, 1)::float8 as rating
  from website_reviews review
  where review.profile_id = profile.id
    and review.marketplace_service_job_id is not null
    and review.is_verified = true
    and review.status = 'approved'
) review_stats on true
group by profile.id, review_stats.review_count, review_stats.rating;

commit;
