-- Align the canonical Directory pilot workplace authority with Swedish-case
-- normalization and SCB municipality-code semantics without modifying applied
-- migrations 0068/0069.
--
-- SCB Kommun is a four-digit municipality code. Current provider normalization
-- maps the confirmed pilot codes 0180/0181 to Stockholm/Södertälje, while this
-- database guard also accepts legacy/raw code-shaped evidence (including
-- numeric JSON forms 180/181).
--
-- Deployment is fail-closed:
-- - no row is published by this migration;
-- - rows previously demoted by 0068 remain Review and recover through the
--   normal revalidation/publication path;
-- - the 0069 eligibility repair is repeated only with corrected location
--   normalization and otherwise preserves the existing evidence contract;
-- - the publication trigger is replaced atomically in this transaction.
--
-- Rollback, if ever required, must be a new forward migration that restores
-- the prior trigger function; applied migrations remain immutable.

begin;

update company_directory_profiles profile
set auto_public_eligible = true
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
  and facts.advertising_blocked is false
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
    translate(lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')), 'ÅÄÖ', 'åäö')
      in ('stockholm', 'södertälje')
    or translate(lower(btrim(scb.workplaces->0->>'municipality')), 'ÅÄÖ', 'åäö')
      in ('stockholm', 'södertälje', '0180', '0181', '180', '181')
  );

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
        translate(lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')), 'ÅÄÖ', 'åäö')
          in ('stockholm', 'södertälje')
        or translate(lower(btrim(scb.workplaces->0->>'municipality')), 'ÅÄÖ', 'åäö')
          in ('stockholm', 'södertälje', '0180', '0181', '180', '181')
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

comment on function company_directory_enforce_pilot_workplace_publication() is
  'Fail-closed Directory publication guard: exactly one complete, conflict-free, <=7-day SCB physical workplace in Stockholm/Södertälje, bound to current profile and Official Facts evidence, with Swedish-case and SCB municipality-code normalization.';

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
  '20260929_0071',
  '20260929_0071_company_directory_pilot_location_normalization.sql',
  null,
  null,
  'migration-0071',
  'canonical-migration',
  'Aligns Directory pilot publication/backfill authority with Swedish uppercase normalization and SCB municipality codes without republishing rows.'
)
on conflict (migration_key) do nothing;

commit;
