-- Preserve an explicit customer choice of one unclaimed Directory company.
--
-- NULL target_profile_id means the existing generic Proffera matching path.
-- A non-NULL target is immutable request intent used by matching/outreach to
-- prevent silently sending the request to other companies.
--
-- Rollout: apply this additive migration before deploying the writer that
-- persists target_profile_id. Existing rows remain generic because the column
-- is nullable and no historical request is rewritten.

begin;

alter table quote_requests
  add column if not exists target_profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'quote_requests'::regclass
      and conname = 'quote_requests_target_profile_fkey'
  ) then
    alter table quote_requests
      add constraint quote_requests_target_profile_fkey
      foreign key (target_profile_id)
      references company_directory_profiles(id)
      on delete restrict
      not valid;
  end if;
end
$$;

alter table quote_requests
  validate constraint quote_requests_target_profile_fkey;

create index if not exists quote_requests_target_profile_created_idx
  on quote_requests (target_profile_id, created_at desc)
  where target_profile_id is not null;

comment on column quote_requests.target_profile_id is
  'Explicit customer-selected Directory company. NULL means generic Proffera matching. Matching must never broaden a non-NULL target automatically.';

insert into proffera_schema_migrations (
  migration_key,
  filename,
  checksum,
  git_sha,
  applied_by,
  execution_mode,
  notes
)
values (
  '20260825_0068',
  '20260825_0068_marketplace_specific_company_request.sql',
  null,
  null,
  'migration-0068',
  'canonical-migration',
  'Adds nullable quote_requests.target_profile_id with validated Directory FK and partial lookup index. Existing requests stay on generic matching.'
)
on conflict (migration_key) do nothing;

commit;
