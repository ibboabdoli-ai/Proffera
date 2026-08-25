import "server-only";

import { getSql } from "@/lib/db/server";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";

export const DIRECTORY_LANDING_MIN_BUSINESSES = 3;

export type DirectorySeoLanding = {
  serviceSlug: string;
  serviceLabel: string;
  location: string;
  locationSlug: string;
  businessCount: number;
};

export function slugifyDirectoryLocation(value: string) {
  return value.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function serviceLabel(serviceSlug: string) {
  return DIRECTORY_SERVICES.find((service) => service.slug === serviceSlug)?.label ?? "";
}

export async function listDirectorySeoLandings(): Promise<DirectorySeoLanding[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    with eligible as (
      select
        profile.id,
        profile.claimed_workspace_id,
        profile.city,
        profile.municipality,
        relation.service_slug,
        scb.workplaces
      from company_directory_profiles profile
      join company_directory_profile_services relation
        on relation.profile_id = profile.id
       and relation.is_active = true
       and relation.public_visible = true
      join company_directory_services service
        on service.slug = relation.service_slug
       and service.is_active = true
      left join company_directory_scb_enrichment scb
        on scb.profile_id = profile.id
       and scb.conflicts = '[]'::jsonb
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
    ), resolved as (
      select
        id,
        service_slug,
        case
          when claimed_workspace_id is null then
            case
              when jsonb_array_length(
                case when jsonb_typeof(workplaces) = 'array' then workplaces else '[]'::jsonb end
              ) = 1
                and nullif(trim(workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
                and nullif(trim(workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
                and nullif(trim(workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
                and nullif(trim(workplaces -> 0 ->> 'municipality'), '') is not null
              then trim(workplaces -> 0 #>> '{visitingAddress,city}')
              else null
            end
          else coalesce(nullif(trim(city), ''), nullif(trim(municipality), ''))
        end as location_label
      from eligible
    )
    select
      service_slug,
      min(location_label) as location_label,
      count(distinct id)::int as business_count
    from resolved
    where location_label is not null
    group by service_slug, lower(location_label)
    having count(distinct id) >= ${DIRECTORY_LANDING_MIN_BUSINESSES}
    order by service_slug asc, location_label asc
  `;

  return rows.flatMap((row) => {
    const serviceSlug = String(row.service_slug ?? "").trim();
    const location = String(row.location_label ?? "").trim();
    const label = serviceLabel(serviceSlug);
    const locationSlug = slugifyDirectoryLocation(location);
    if (!serviceSlug || !label || !location || !locationSlug) return [];
    return [{ serviceSlug, serviceLabel: label, location, locationSlug, businessCount: Number(row.business_count ?? 0) }];
  });
}

export async function getDirectorySeoLanding(serviceSlug: string, locationSlug: string) {
  const normalizedService = serviceSlug.trim().toLowerCase();
  const normalizedLocation = locationSlug.trim().toLowerCase();
  if (!serviceLabel(normalizedService) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedLocation)) return null;
  const landings = await listDirectorySeoLandings();
  return landings.find((landing) => landing.serviceSlug === normalizedService && landing.locationSlug === normalizedLocation) ?? null;
}
