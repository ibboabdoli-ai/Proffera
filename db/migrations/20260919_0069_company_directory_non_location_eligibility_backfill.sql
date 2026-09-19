-- Repair legacy auto_public_eligible bits that were previously coupled to
-- registered/profile geography. Canonical SCB workplace evidence now owns pilot
-- geography; this backfill only repairs the persisted non-location eligibility bit.
--
-- This migration does not publish any profile. Review/Ready recovery still passes
-- through Official Facts, SCB freshness/conflict checks, confidence gates and the
-- canonical workplace publication trigger from migration 0068.

begin;

update company_directory_profiles profile
set auto_public_eligible = true,
    updated_at = now()
where profile.auto_public_eligible = false
  and profile.country_code = 'SE'
  and profile.organization_kind = 'juridical_person'
  and profile.is_active = true
  and profile.privacy_blocked = false
  and nullif(btrim(profile.category_slug), '') is not null
  and not (coalesce(profile.quality_reasons, '[]'::jsonb) ? 'primary_sni_not_confirmed');

-- The original foundation guard still required profile.city for Published rows.
-- Geography is now authorized exclusively by the canonical SCB workplace trigger,
-- so keep the generic public guard focused on non-location publication safety.
alter table company_directory_profiles
  drop constraint if exists company_directory_profiles_public_guard;

alter table company_directory_profiles
  add constraint company_directory_profiles_public_guard
  check (
    publication_status <> 'published' or (
      is_active = true
      and auto_public_eligible = true
      and privacy_blocked = false
      and organization_kind = 'juridical_person'
      and quality_score >= 80
      and legal_name <> ''
      and category_slug <> ''
    )
  );

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
  '20260919_0069',
  '20260919_0069_company_directory_non_location_eligibility_backfill.sql',
  null,
  null,
  'migration-0069',
  'canonical-migration',
  'Backfills legacy location-derived auto_public_eligible=false rows and removes the obsolete profile.city requirement from the generic public guard; publication remains protected by migration 0068 canonical SCB workplace authority.'
)
on conflict (migration_key) do nothing;

commit;
