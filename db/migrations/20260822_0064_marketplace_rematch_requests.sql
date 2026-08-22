begin;

-- A cancelled/problem Marketplace job never silently promotes a losing offer.
-- The customer must explicitly ask Proffera to rematch. Auto-outreach workers
-- can consume this queue later without rewriting the immutable winner history.
create table if not exists marketplace_rematch_requests (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null unique references marketplace_service_jobs(id) on delete cascade,
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  status text not null default 'pending',
  reason text not null default '',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_rematch_requests_status_check check (status in ('pending', 'processing', 'processed', 'cancelled')),
  constraint marketplace_rematch_requests_reason_check check (char_length(reason) <= 1000),
  constraint marketplace_rematch_requests_processed_check check (
    (status = 'processed') = (processed_at is not null)
  )
);

create index if not exists marketplace_rematch_requests_pending_idx
  on marketplace_rematch_requests (created_at, id)
  where status = 'pending';

create or replace function enforce_marketplace_rematch_request()
returns trigger
language plpgsql
as $$
declare
  job_quote_id uuid;
  job_status text;
begin
  select quote_request_id, status
    into job_quote_id, job_status
    from marketplace_service_jobs
   where id = new.service_job_id
   for key share;

  if job_quote_id is null
     or job_quote_id <> new.quote_request_id
     or job_status not in ('customer_cancelled', 'provider_cancelled', 'no_show', 'problem') then
    raise exception using errcode = '23514', message = 'marketplace_rematch_job_not_eligible';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_rematch_request_guard_trigger on marketplace_rematch_requests;
create trigger marketplace_rematch_request_guard_trigger
before insert or update of service_job_id, quote_request_id
on marketplace_rematch_requests
for each row execute function enforce_marketplace_rematch_request();

commit;
