begin;

create table if not exists company_directory_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_url text not null default '',
  fingerprint text not null,
  status text not null default 'processing',
  discovered_count integer not null default 0,
  accepted_count integer not null default 0,
  error_summary text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint company_directory_source_snapshots_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint company_directory_source_snapshots_count_check
    check (discovered_count >= 0 and accepted_count >= 0)
);

create unique index if not exists company_directory_source_snapshot_unique_idx
  on company_directory_source_snapshots (provider, fingerprint);
create index if not exists company_directory_source_snapshot_seen_idx
  on company_directory_source_snapshots (last_seen_at desc);

create table if not exists company_directory_discovery_queue (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'SE',
  organization_number text not null,
  provider text not null,
  source_fingerprint text not null default '',
  source_url text not null default '',
  state text not null default 'pending_verify',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_at timestamptz,
  profile_id uuid references company_directory_profiles(id) on delete set null,
  constraint company_directory_discovery_queue_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint company_directory_discovery_queue_org_check check (organization_number ~ '^[0-9]{10}$'),
  constraint company_directory_discovery_queue_state_check check (
    state in ('pending_verify', 'processing', 'ready', 'review', 'blocked', 'inactive', 'published', 'claimed', 'failed')
  ),
  constraint company_directory_discovery_queue_attempt_check check (attempt_count >= 0),
  constraint company_directory_discovery_queue_lock_pair_check check (
    (locked_at is null and lock_token is null)
    or (locked_at is not null and lock_token is not null)
  )
);

create unique index if not exists company_directory_discovery_country_org_unique_idx
  on company_directory_discovery_queue (country_code, organization_number);
create index if not exists company_directory_discovery_pending_idx
  on company_directory_discovery_queue (next_attempt_at, first_seen_at)
  where state in ('pending_verify', 'processing');
create index if not exists company_directory_discovery_state_idx
  on company_directory_discovery_queue (state, last_seen_at desc);

create or replace function sync_company_directory_discovery_queue_from_profile()
returns trigger
language plpgsql
as $$
begin
  update company_directory_discovery_queue
  set state = case
        when new.publication_status in ('ready', 'review', 'blocked', 'inactive', 'published', 'claimed')
          then new.publication_status
        else state
      end,
      profile_id = new.id,
      verified_at = now(),
      locked_at = null,
      lock_token = null,
      last_error = '',
      next_attempt_at = now(),
      last_seen_at = greatest(last_seen_at, now())
  where country_code = new.country_code
    and organization_number = regexp_replace(new.organization_number, '[^0-9]', '', 'g');
  return new;
end;
$$;

drop trigger if exists company_directory_profile_updates_discovery_queue on company_directory_profiles;
create trigger company_directory_profile_updates_discovery_queue
after insert or update of publication_status, quality_score, privacy_blocked, auto_public_eligible
on company_directory_profiles
for each row
execute function sync_company_directory_discovery_queue_from_profile();

comment on table company_directory_source_snapshots is
  'Metadata for official discovery snapshots. Raw bulk payloads are not stored.';
comment on table company_directory_discovery_queue is
  'Durable, idempotent queue of official company identifiers waiting for detail verification and profile building.';

commit;
