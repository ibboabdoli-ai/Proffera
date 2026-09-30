-- Align the Directory pilot database invariant with canonical SCB workplace authority.
--
-- This migration is intentionally fail-closed:
-- - existing published profiles with structurally unsafe/out-of-pilot SCB workplace evidence are demoted to Review;
-- - the legacy profile city/municipality CHECK is removed;
-- - every future transition to publication_status='published' must have one complete,
--   conflict-free, fresh SCB workplace in Stockholm/Södertälje, bound to the current
--   profile/Official Facts evidence snapshot.
--
-- The trigger validates transitions into published only. Updates that preserve an
-- already-published row are not blocked; a transition into Published may only change
-- publication metadata, so evidence bound to the pre-transition profile cannot authorize
-- simultaneously-mutated identity/synchronization fields. Later SCB/profile changes are
-- handled by the published revalidation worker, which refreshes evidence and demotes unsafe rows.

begin;

with unsafe_published as (
  select profile.id
  from company_directory_profiles profile
  left join company_directory_scb_enrichment scb
    on scb.profile_id = profile.id
  where profile.publication_status = 'published'
    and (
      scb.profile_id is null
      or jsonb_array_length(
        case
          when jsonb_typeof(scb.workplaces) = 'array' then scb.workplaces
          else '[]'::jsonb
        end
      ) <> 1
      or case
        when jsonb_typeof(scb.conflicts) = 'array' then jsonb_array_length(scb.conflicts) > 0
        else true
      end
      or nullif(btrim(scb.workplaces->0->'visitingAddress'->>'addressLine'), '') is null
      or nullif(btrim(scb.workplaces->0->'visitingAddress'->>'postalCode'), '') is null
      or nullif(btrim(scb.workplaces->0->'visitingAddress'->>'city'), '') is null
      or nullif(btrim(scb.workplaces->0->>'municipality'), '') is null
      or not (
        lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')) in ('stockholm', 'södertälje')
        or lower(btrim(scb.workplaces->0->>'municipality')) in ('stockholm', 'södertälje')
      )
    )
)
update company_directory_profiles profile
set publication_status = 'review',
    published_at = null,
    updated_at = now()
from unsafe_published unsafe
where profile.id = unsafe.id
  and profile.publication_status = 'published';

alter table company_directory_profiles
  drop constraint if exists company_directory_profiles_pilot_location_guard;

create or replace function company_directory_enforce_pilot_workplace_publication()
returns trigger
language plpgsql
as $$
declare
  evidence_profile_updated_token text;
  evidence_profile_last_synced_at timestamptz;
begin
  if new.publication_status <> 'published'
     or (tg_op = 'UPDATE' and old.publication_status = 'published') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (
       to_jsonb(new) - array['publication_status', 'published_at', 'updated_at']::text[]
       is distinct from
       to_jsonb(old) - array['publication_status', 'published_at', 'updated_at']::text[]
     ) then
    raise exception using
      errcode = '23514',
      constraint = 'company_directory_profiles_pilot_workplace_guard',
      message = 'publishing a Directory profile cannot simultaneously change evidence-relevant profile fields';
  end if;

  if tg_op = 'UPDATE' then
    evidence_profile_updated_token := old.updated_at::text;
    evidence_profile_last_synced_at := old.last_synced_at;
  else
    evidence_profile_updated_token := new.updated_at::text;
    evidence_profile_last_synced_at := new.last_synced_at;
  end if;

  if not exists (
    select 1
    from company_directory_scb_enrichment scb
    join company_directory_official_facts facts
      on facts.profile_id = scb.profile_id
    where scb.profile_id = new.id
      and facts.source_payload_hash <> ''
      and facts.last_synced_at >= evidence_profile_last_synced_at
      and scb.source_payload_hash <> ''
      and scb.last_synced_at >= now() - interval '7 days'
      and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = evidence_profile_updated_token
      and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
      and jsonb_typeof(scb.conflicts) = 'array'
      and jsonb_array_length(scb.conflicts) = 0
      and jsonb_array_length(
        case
          when jsonb_typeof(scb.workplaces) = 'array' then scb.workplaces
          else '[]'::jsonb
        end
      ) = 1
      and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'addressLine'), '') is not null
      and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'postalCode'), '') is not null
      and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'city'), '') is not null
      and nullif(btrim(scb.workplaces->0->>'municipality'), '') is not null
      and (
        lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')) in ('stockholm', 'södertälje')
        or lower(btrim(scb.workplaces->0->>'municipality')) in ('stockholm', 'södertälje')
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'company_directory_profiles_pilot_workplace_guard',
      message = 'published Directory profiles require fresh canonical SCB workplace evidence inside the pilot';
  end if;

  return new;
end;
$$;

drop trigger if exists company_directory_profiles_pilot_workplace_guard
  on company_directory_profiles;

create trigger company_directory_profiles_pilot_workplace_guard
before insert or update of publication_status
on company_directory_profiles
for each row
execute function company_directory_enforce_pilot_workplace_publication();

comment on function company_directory_enforce_pilot_workplace_publication() is
  'Fail-closed Directory publication guard: exactly one complete, conflict-free, <=7-day SCB physical workplace in Stockholm/Södertälje, bound to current profile and Official Facts evidence.';

comment on trigger company_directory_profiles_pilot_workplace_guard
  on company_directory_profiles is
  'Supersedes the legacy profile city/municipality pilot CHECK with canonical SCB workplace authority for publication transitions.';

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
  '20260919_0068',
  '20260919_0068_company_directory_pilot_workplace_guard.sql',
  null,
  null,
  'migration-0068',
  'canonical-migration',
  'Demotes definitively unsafe published Directory rows and replaces the registered/profile-location pilot CHECK with a fresh canonical SCB workplace publication trigger.'
)
on conflict (migration_key) do nothing;

commit;
