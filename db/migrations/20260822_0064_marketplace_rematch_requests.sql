begin;

-- Rematching never rewrites the immutable winner history on the original Quote
-- Request. Migration 0062 deliberately permits only one selected offer per
-- quote_request_id, so every rematch owns a fresh Quote Request generation.
--
-- Deployment order: apply 0063 before 0064 so marketplace_service_jobs exists.
-- Rollback order is the reverse: remove 0064 before rolling back 0063.
create table if not exists marketplace_rematch_requests (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null unique references marketplace_service_jobs(id) on delete cascade,
  -- Keep the source request while a rematch generation exists. NO ACTION is
  -- intentional rather than RESTRICT: a direct source Quote Request purge first
  -- cascades through marketplace_service_jobs and removes this rematch row, then
  -- the end-of-statement FK check succeeds without depending on cascade ordering.
  -- The copied rematch Quote Request is still removed through its own cascade.
  source_quote_request_id uuid not null references quote_requests(id) on delete no action,
  rematch_quote_request_id uuid not null unique references quote_requests(id) on delete cascade,
  status text not null default 'pending',
  reason text not null default '',
  processing_started_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_rematch_requests_generation_check check (source_quote_request_id <> rematch_quote_request_id),
  constraint marketplace_rematch_requests_status_check check (status in ('pending', 'processing', 'processed', 'cancelled')),
  constraint marketplace_rematch_requests_reason_check check (char_length(reason) <= 1000),
  constraint marketplace_rematch_requests_processing_check check (
    status <> 'processing' or (processing_started_at is not null and processed_at is null)
  ),
  constraint marketplace_rematch_requests_processed_check check (
    status <> 'processed' or processed_at is not null
  )
);

create index if not exists marketplace_rematch_requests_pending_idx
  on marketplace_rematch_requests (created_at, id)
  where status = 'pending';
create index if not exists marketplace_rematch_requests_processing_idx
  on marketplace_rematch_requests (processing_started_at, id)
  where status = 'processing';

create or replace function enforce_marketplace_rematch_request()
returns trigger
language plpgsql
as $$
declare
  job_quote_id uuid;
  job_status text;
  rematch_status text;
begin
  select quote_request_id, status
    into job_quote_id, job_status
    from marketplace_service_jobs
   where id = new.service_job_id
   for key share;

  select status
    into rematch_status
    from quote_requests
   where id = new.rematch_quote_request_id
   for key share;

  if job_quote_id is null
     or job_quote_id <> new.source_quote_request_id
     or job_status not in ('customer_cancelled', 'provider_cancelled', 'no_show', 'problem')
     or rematch_status is null
     or rematch_status not in ('draft', 'submitted', 'pending_review', 'approved', 'matched', 'answered') then
    raise exception using errcode = '23514', message = 'marketplace_rematch_generation_not_eligible';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_rematch_request_guard_trigger on marketplace_rematch_requests;
create trigger marketplace_rematch_request_guard_trigger
before insert or update of service_job_id, source_quote_request_id, rematch_quote_request_id
on marketplace_rematch_requests
for each row execute function enforce_marketplace_rematch_request();

-- Once a customer has requested a rematch, the source job is historical. In
-- particular a `problem` job must not be reopened while a new provider search is
-- already underway.
create or replace function block_marketplace_job_reopen_after_rematch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.status <> old.status
     and exists (
       select 1
       from marketplace_rematch_requests rematch
       where rematch.service_job_id = old.id
         and rematch.status in ('pending', 'processing', 'processed')
     ) then
    raise exception using errcode = '23514', message = 'marketplace_service_job_rematch_already_requested';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_service_job_rematch_terminal_guard_trigger on marketplace_service_jobs;
create trigger marketplace_service_job_rematch_terminal_guard_trigger
before update of status on marketplace_service_jobs
for each row execute function block_marketplace_job_reopen_after_rematch();

-- The Company Directory profile is the durable provider identity. A company may
-- complete Marketplace work while unclaimed and claim the profile later. Resolve
-- workspace ownership at read time instead of rewriting immutable offer/job/review
-- history or losing reputation accumulated before the claim.
create or replace view marketplace_workspace_service_jobs as
select
  job.*,
  coalesce(job.workspace_id, profile.claimed_workspace_id) as resolved_workspace_id
from marketplace_service_jobs job
join company_directory_profiles profile on profile.id = job.profile_id;

create or replace view marketplace_workspace_profile_reputation as
select
  reputation.*,
  coalesce(reputation_workspace.workspace_id, profile.claimed_workspace_id) as resolved_workspace_id
from marketplace_profile_reputation reputation
join company_directory_profiles profile on profile.id = reputation.profile_id
left join lateral (
  select job.workspace_id
  from marketplace_service_jobs job
  where job.profile_id = reputation.profile_id
    and job.workspace_id is not null
  order by job.updated_at desc, job.id desc
  limit 1
) reputation_workspace on true;

comment on view marketplace_workspace_service_jobs is
  'Marketplace ServiceJob history resolved to the current claimed workspace without rewriting original provider identity.';
comment on view marketplace_workspace_profile_reputation is
  'Profile reputation uses the latest durable job workspace when present, otherwise the current claimed workspace; pre-claim history remains attached through profile_id.';

commit;
