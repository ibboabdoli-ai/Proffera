-- Repair legacy auto_public_eligible bits that were previously coupled to
-- registered/profile geography. Canonical SCB workplace evidence now owns pilot
-- geography; this backfill only repairs rows that are already structurally safe
-- under the canonical physical-workplace policy.
--
-- This migration does not publish any profile. Review/Ready recovery still passes
-- through Official Facts, SCB freshness/conflict checks, confidence gates and the
-- canonical workplace publication trigger from migration 0068.

begin;

update company_directory_profiles profile
set auto_public_eligible = true,
    updated_at = now()
from company_directory_scb_enrichment scb,
     company_directory_official_facts facts
where scb.profile_id = profile.id
  and facts.profile_id = profile.id
  and profile.auto_public_eligible = false
  and profile.country_code = 'SE'
  and profile.organization_kind = 'juridical_person'
  and profile.is_active = true
  and profile.privacy_blocked = false
  and nullif(btrim(profile.category_slug), '') is not null
  and not (coalesce(profile.quality_reasons, '[]'::jsonb) ? 'primary_sni_not_confirmed')
  and facts.source_payload_hash <> ''
  and facts.last_synced_at >= profile.last_synced_at
  and facts.deregistration_date is null
  and coalesce(facts.advertising_blocked, false) = false
  and (
    case
      when jsonb_typeof(facts.ongoing_procedures) = 'array'
        then jsonb_array_length(facts.ongoing_procedures)
      else 1
    end
  ) = 0
  and scb.source_payload_hash <> ''
  and scb.last_synced_at >= now() - interval '7 days'
  and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
  and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
  and (
    coalesce(profile.quality_reasons, '[]'::jsonb) ? 'outside_pilot_area'
    or coalesce(profile.quality_reasons, '[]'::jsonb) ? 'missing_city'
  )
  and jsonb_typeof(scb.conflicts) = 'array'
  and jsonb_array_length(scb.conflicts) = 0
  and jsonb_typeof(scb.workplaces) = 'array'
  and jsonb_array_length(scb.workplaces) = 1
  and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'addressLine'), '') is not null
  and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'postalCode'), '') is not null
  and nullif(btrim(scb.workplaces->0->'visitingAddress'->>'city'), '') is not null
  and nullif(btrim(scb.workplaces->0->>'municipality'), '') is not null
  and (
    lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')) in ('stockholm', 'södertälje')
    or lower(btrim(scb.workplaces->0->>'municipality')) in ('stockholm', 'södertälje')
  );

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
  'Backfills only legacy location-derived eligibility rows with one structurally safe in-pilot canonical SCB workplace and removes the obsolete profile.city requirement from the generic public guard.'
)
on conflict (migration_key) do nothing;

commit;
