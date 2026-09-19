import "server-only";

import { readPublicDirectoryRoutingMissCache } from "@/lib/company-directory-public-cache";
import { DIRECTORY_PILOT_LOCATIONS } from "@/lib/company-directory-policy";
import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

const PILOT_LOCATION_CSV = DIRECTORY_PILOT_LOCATIONS.join(",");

export async function getClaimedDirectoryWorkspaceSlug(directorySlug: string) {
  const slug = directorySlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  return readPublicDirectoryRoutingMissCache(slug, async () => {
    const sql = getSql();
    if (!sql) return { cache: false, value: null };

    const rows = await sql`
      select workspace.id::text as workspace_id, workspace.slug
      from company_directory_profiles profile
      join workspaces workspace on workspace.id = profile.claimed_workspace_id
      where profile.public_slug = ${slug}
        and profile.publication_status = 'claimed'
        and profile.claimed_workspace_id is not null
        and profile.published_at is not null
        and profile.is_active = true
        and profile.privacy_blocked = false
        and profile.auto_public_eligible = true
        and workspace.status in ('active', 'trial')
        and (
          (
            profile.organization_kind = 'juridical_person'
            and exists (
              select 1
              from company_directory_official_facts claimed_facts
              join company_directory_scb_enrichment claimed_scb
                on claimed_scb.profile_id = claimed_facts.profile_id
              where claimed_facts.profile_id = profile.id
                and claimed_facts.source_payload_hash <> ''
                and claimed_facts.last_synced_at >= profile.last_synced_at
                and claimed_facts.deregistration_date is null
                and coalesce(claimed_facts.advertising_blocked, false) = false
                and (
                  case
                    when jsonb_typeof(claimed_facts.ongoing_procedures) = 'array'
                      then jsonb_array_length(claimed_facts.ongoing_procedures)
                    else 1
                  end
                ) = 0
                and claimed_scb.source_payload_hash <> ''
                and claimed_scb.last_synced_at >= now() - interval '7 days'
                and claimed_scb.last_synced_at >= profile.last_synced_at
                and claimed_scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = claimed_facts.last_synced_at::text
                and jsonb_typeof(claimed_scb.conflicts) = 'array'
                and jsonb_array_length(claimed_scb.conflicts) = 0
                and jsonb_typeof(claimed_scb.workplaces) = 'array'
                and jsonb_array_length(claimed_scb.workplaces) = 1
                and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'addressLine'), '') is not null
                and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'postalCode'), '') is not null
                and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'city'), '') is not null
                and nullif(btrim(claimed_scb.workplaces->0->>'municipality'), '') is not null
                and (
                  lower(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'city')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                  or lower(btrim(claimed_scb.workplaces->0->>'municipality')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                )
            )
          )
          or (
            profile.organization_kind = 'sole_trader'
            and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
            and exists (
              select 1
              from company_directory_claims owner_claim
              where owner_claim.profile_id = profile.id
                and owner_claim.requested_workspace_id = profile.claimed_workspace_id
                and owner_claim.status = 'claimed'
                and owner_claim.verification_method = 'manual_review'
            )
            and exists (
              select 1
              from company_directory_profile_locations owner_base
              where owner_base.profile_id = profile.id
                and owner_base.owner_workspace_id = profile.claimed_workspace_id
                and owner_base.source_type = 'owner'
                and owner_base.purpose = 'service_base'
                and owner_base.is_active = true
                and owner_base.is_primary = true
                and owner_base.confirmed_at is not null
                and owner_base.latitude is not null
                and owner_base.longitude is not null
                and not (owner_base.latitude = 0 and owner_base.longitude = 0)
                and owner_base.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'
                and owner_base.geocode_precision = 'address'
                and (
                  lower(btrim(owner_base.city)) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                  or lower(btrim(owner_base.municipality)) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                )
            )
          )
        )
      limit 1
    `;

    const workspaceId = String(rows[0]?.workspace_id ?? "").trim();
    const workspaceSlug = String(rows[0]?.slug ?? "").trim();
    if (!workspaceId || !workspaceSlug) return { cache: true, value: null };

    const websiteBuilder = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder");
    return {
      cache: false,
      value: websiteBuilder ? workspaceSlug : null,
    };
  });
}
