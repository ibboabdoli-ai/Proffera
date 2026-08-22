-- Repair two Company Directory projection gaps found during the 2026-08-21 Production audit:
-- 1. SCB company municipality was stored in enrichment but not projected into blank profiles.
-- 2. The runtime taxonomy maps SNI 96.210 to `frisor`, but the relational service seed predates that mapping.
--
-- This migration is intentionally conservative:
-- - existing non-empty profile municipality values are never overwritten;
-- - only SNI-owned service relations are reconciled;
-- - owner/admin/website service relations are not changed;
-- - no publication status is changed.
--
-- Deployment sequencing:
-- - apply the existing Company Directory foundation/provenance migrations first;
-- - migration 0038 must already provide the provenance conflict-target unique index;
-- - this repair validates that prerequisite before any data repair work starts;
-- - if the index is unexpectedly missing on a live database, stop this repair and
--   restore it in a separately reviewed maintenance step with CREATE UNIQUE INDEX
--   CONCURRENTLY, then rerun this migration. Do not build the index while holding
--   this repair transaction open.
-- - pgcrypto is re-asserted here before digest() is used.
-- Rollback:
-- - revert any writer/runtime change first;
-- - this migration only fills previously blank municipality values and SNI-owned
--   service projections. Do not automatically erase those verified projections;
--   a data rollback must be a separately reviewed, targeted repair.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_index index_state
    where index_state.indexrelid = to_regclass('public.company_directory_field_sources_value_unique_idx')
      and index_state.indrelid = to_regclass('public.company_directory_field_sources')
      and index_state.indisunique
      and index_state.indisvalid
      and index_state.indnkeyatts = 4
      and index_state.indpred is null
      and index_state.indexprs is null
      and (
        select array_agg(pg_get_indexdef(index_state.indexrelid, key_position, true) order by key_position)
        from generate_series(1, index_state.indnkeyatts) as key_position
      ) = array['profile_id', 'field_name', 'source_name', 'value_hash']::text[]
  ) then
    raise exception using
      message = 'Required provenance unique index is missing or invalid',
      hint = 'Apply migration 0038 or restore company_directory_field_sources_value_unique_idx with CREATE UNIQUE INDEX CONCURRENTLY in a separate maintenance step before running migration 0058.';
  end if;
end
$$;

insert into company_directory_service_categories (
  slug, label, search_aliases, sort_order, is_active, updated_at
) values (
  'frisor', 'Frisör', array['frisör', 'frisor', 'frisörer', 'frisorer', 'barberare'], 90, true, now()
)
on conflict (slug) do update set
  label = excluded.label,
  search_aliases = excluded.search_aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now()
where company_directory_service_categories.label is distinct from excluded.label
   or company_directory_service_categories.search_aliases is distinct from excluded.search_aliases
   or company_directory_service_categories.sort_order is distinct from excluded.sort_order
   or company_directory_service_categories.is_active is distinct from true;

insert into company_directory_services (
  slug, category_slug, parent_service_slug, label, search_aliases, sort_order, is_active, updated_at
) values (
  'frisor', 'frisor', null, 'Frisör / Barberare',
  array['frisör', 'frisor', 'frisörer', 'frisorer', 'barberare'], 10, true, now()
)
on conflict (slug) do update set
  category_slug = excluded.category_slug,
  parent_service_slug = excluded.parent_service_slug,
  label = excluded.label,
  search_aliases = excluded.search_aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now()
where company_directory_services.category_slug is distinct from excluded.category_slug
   or company_directory_services.parent_service_slug is distinct from excluded.parent_service_slug
   or company_directory_services.label is distinct from excluded.label
   or company_directory_services.search_aliases is distinct from excluded.search_aliases
   or company_directory_services.sort_order is distinct from excluded.sort_order
   or company_directory_services.is_active is distinct from true;

-- A non-SNI relation owns the same primary key and must never be silently replaced.
-- If it is inactive or hidden, continuing would deactivate competing SNI relations
-- without creating an active public `frisor` replacement, so fail before any relation repair.
do $$
begin
  if exists (
    select 1
    from company_directory_profiles profile
    join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.service_slug = 'frisor'
    where profile.primary_sni_code = '96.210'
      and relation.source_type <> 'sni'
      and (relation.is_active is not true or relation.public_visible is not true)
  ) then
    raise exception using
      message = 'Incompatible non-SNI frisor relation blocks SNI repair',
      hint = 'Review the existing owner/admin/website frisor relation before rerunning migration 0058; this migration will not overwrite or reactivate non-SNI relations.';
  end if;
end
$$;

-- Mirror the engine invariant: a profile has at most one active primary service inferred from SNI.
update company_directory_profile_services relation
set is_primary = false,
    is_active = false,
    updated_at = now()
from company_directory_profiles profile
where relation.profile_id = profile.id
  and profile.primary_sni_code = '96.210'
  and relation.source_type = 'sni'
  and relation.service_slug <> 'frisor'
  and (relation.is_primary = true or relation.is_active = true);

insert into company_directory_profile_services (
  profile_id, service_slug, source_type, confidence,
  is_primary, is_active, public_visible, confirmed_at
)
select
  profile.id, 'frisor', 'sni', 85,
  true, true, true, null
from company_directory_profiles profile
where profile.primary_sni_code = '96.210'
on conflict (profile_id, service_slug) do update set
  confidence = excluded.confidence,
  is_primary = true,
  is_active = true,
  public_visible = true,
  updated_at = now()
where company_directory_profile_services.source_type = 'sni'
  and (
    company_directory_profile_services.confidence is distinct from excluded.confidence
    or company_directory_profile_services.is_primary is distinct from true
    or company_directory_profile_services.is_active is distinct from true
    or company_directory_profile_services.public_visible is distinct from true
  );

-- Backfill existing SCB-synced profiles. Do not bump profile.updated_at: that token is part
-- of the SCB comparison snapshot and changing it here would make the existing fresh snapshot stale.
with candidates as (
  select
    profile.id,
    scb.organization_number,
    trim(scb.municipality) as municipality
  from company_directory_profiles profile
  join company_directory_scb_enrichment scb on scb.profile_id = profile.id
  where profile.country_code = 'SE'
    and profile.organization_number = scb.organization_number
    and nullif(trim(profile.municipality), '') is null
    and nullif(trim(scb.municipality), '') is not null
), projected as (
  update company_directory_profiles profile
  set municipality = candidates.municipality
  from candidates
  where profile.id = candidates.id
    and nullif(trim(profile.municipality), '') is null
  returning profile.id
)
insert into company_directory_field_sources (
  profile_id, field_name, source_name, source_record_id,
  source_url, value_hash, confidence, observed_at
)
select
  projected.id,
  'municipality',
  'scb_foretagsregistret',
  scb.organization_number,
  '',
  encode(digest(trim(scb.municipality), 'sha256'), 'hex'),
  100,
  now()
from projected
join company_directory_scb_enrichment scb on scb.profile_id = projected.id
on conflict (profile_id, field_name, source_name, value_hash) do update set
  source_record_id = excluded.source_record_id,
  confidence = excluded.confidence,
  observed_at = now();

commit;
