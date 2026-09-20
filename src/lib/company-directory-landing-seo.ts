import "server-only";

import { getSql } from "@/lib/db/server";
import { DIRECTORY_PILOT_LOCATIONS } from "@/lib/company-directory-policy";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";

export const DIRECTORY_LANDING_MIN_BUSINESSES = 3;
const PILOT_LOCATION_CSV = DIRECTORY_PILOT_LOCATIONS.join(",");

export type DirectorySeoLanding = {
  serviceSlug: string;
  serviceLabel: string;
  location: string;
  locationSlug: string;
  businessCount: number;
};

function isMissingDirectorySchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: unknown; message?: unknown };
  const message = String(row.message ?? "");
  return String(row.code ?? "") === "42P01"
    || message.includes("company_directory_profiles")
    || message.includes("company_directory_scb_enrichment");
}

export function slugifyDirectoryLocation(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serviceLabel(serviceSlug: string) {
  return DIRECTORY_SERVICES.find((service) => service.slug === serviceSlug)?.label ?? "";
}

export async function listDirectorySeoLandings(): Promise<DirectorySeoLanding[]> {
  const sql = getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      with eligible as (
        select
          profile.id,
          relation.service_slug,
          trim(scb.workplaces -> 0 #>> '{visitingAddress,city}') as workplace_city
        from company_directory_profiles profile
        join company_directory_profile_services relation
          on relation.profile_id = profile.id
         and relation.is_active = true
         and relation.public_visible = true
        join company_directory_services service
          on service.slug = relation.service_slug
         and service.is_active = true
        join company_directory_official_facts facts
          on facts.profile_id = profile.id
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
        join company_directory_scb_enrichment scb
          on scb.profile_id = profile.id
         and scb.source_payload_hash <> ''
         and scb.last_synced_at >= now() - interval '7 days'
         and scb.last_synced_at >= profile.last_synced_at
         and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
         and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
         and jsonb_typeof(scb.conflicts) = 'array'
         and jsonb_array_length(scb.conflicts) = 0
         and jsonb_typeof(scb.workplaces) = 'array'
         and jsonb_array_length(scb.workplaces) = 1
        where profile.publication_status = 'published'
          and profile.organization_kind = 'juridical_person'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and profile.claimed_workspace_id is null
          and nullif(trim(scb.workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
          and nullif(trim(scb.workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
          and nullif(trim(scb.workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
          and nullif(trim(scb.workplaces -> 0 ->> 'municipality'), '') is not null
          and (
            lower(btrim(scb.workplaces->0->'visitingAddress'->>'city')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
            or lower(btrim(scb.workplaces->0->>'municipality')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
          )
      )
      select
        service_slug,
        min(workplace_city) as location_label,
        count(distinct id)::int as business_count
      from eligible
      group by service_slug, lower(workplace_city)
      having count(distinct id) >= ${DIRECTORY_LANDING_MIN_BUSINESSES}
      order by service_slug asc, location_label asc
    `;

    return rows.flatMap((row) => {
      const serviceSlug = String(row.service_slug ?? "").trim();
      const location = String(row.location_label ?? "").trim();
      const label = serviceLabel(serviceSlug);
      const locationSlug = slugifyDirectoryLocation(location);
      if (!serviceSlug || !label || !location || !locationSlug) return [];
      return [{
        serviceSlug,
        serviceLabel: label,
        location,
        locationSlug,
        businessCount: Number(row.business_count ?? 0),
      }];
    });
  } catch (error) {
    if (isMissingDirectorySchema(error)) return [];
    throw error;
  }
}

export async function getDirectorySeoLanding(serviceSlug: string, locationSlug: string) {
  const normalizedService = serviceSlug.trim().toLowerCase();
  const normalizedLocation = locationSlug.trim().toLowerCase();
  if (!serviceLabel(normalizedService) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedLocation)) return null;

  const landings = await listDirectorySeoLandings();
  return landings.find(
    (landing) => landing.serviceSlug === normalizedService && landing.locationSlug === normalizedLocation,
  ) ?? null;
}
