import "server-only";

import { getSql } from "@/lib/db/server";
import { normalizeDirectoryRadiusKm, parseDirectoryCoordinates } from "@/lib/company-directory-distance";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";

export type CompanyDirectorySearchInput = {
  service?: string;
  location?: string;
  limit?: number;
  streetAddressOnly?: boolean;
  latitude?: number | string;
  longitude?: number | string;
  radiusKm?: number | string;
  requireCoordinates?: boolean;
};

export type CompanyDirectorySearchResult = {
  id: string;
  slug: string;
  companyName: string;
  categorySlug: string;
  serviceSlug: string;
  serviceLabel: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  qualityScore: number;
  publicationStatus: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
};

export type CompanyDirectorySearchResponse = {
  serviceQuery: string;
  locationQuery: string;
  serviceResolved: boolean;
  nearbyRequested: boolean;
  nearbyEnabled: boolean;
  radiusKm: number;
  results: CompanyDirectorySearchResult[];
};

function cleanSearchValue(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

export function normalizeDirectoryLocationQuery(value: unknown) {
  return cleanSearchValue(value).toLocaleLowerCase("sv-SE");
}

export async function searchCompanyDirectory(
  input: CompanyDirectorySearchInput = {},
): Promise<CompanyDirectorySearchResponse> {
  const sql = getSql();
  const serviceQuery = cleanSearchValue(input.service);
  const locationQuery = cleanSearchValue(input.location);
  const normalizedLocation = normalizeDirectoryLocationQuery(locationQuery);
  const resolution = serviceQuery ? resolveDirectoryServiceQuery(serviceQuery) : null;
  const limit = boundedLimit(input.limit);
  const streetAddressOnly = input.streetAddressOnly === true;
  const coordinates = parseDirectoryCoordinates(input.latitude, input.longitude);
  const nearbyRequested = input.latitude !== undefined || input.longitude !== undefined;
  const nearbyEnabled = coordinates !== null;
  const radiusKm = normalizeDirectoryRadiusKm(input.radiusKm, 25);
  const requireCoordinates = input.requireCoordinates === true || nearbyEnabled;

  const emptyResponse = (serviceResolved: boolean): CompanyDirectorySearchResponse => ({
    serviceQuery,
    locationQuery,
    serviceResolved,
    nearbyRequested,
    nearbyEnabled,
    radiusKm,
    results: [],
  });

  if (!sql) return emptyResponse(!serviceQuery || Boolean(resolution));
  if (serviceQuery && !resolution) return emptyResponse(false);

  const serviceSlug = resolution?.kind === "service" ? resolution.serviceSlug : "";
  const categorySlug = resolution?.categorySlug ?? "";
  const originLatitude = coordinates?.latitude ?? 0;
  const originLongitude = coordinates?.longitude ?? 0;

  const rows = await sql`
    with matches as (
      select
        profile.id::text,
        profile.public_slug,
        profile.display_name,
        profile.category_slug,
        relation.service_slug,
        service.label as service_label,
        profile.address_line1,
        profile.postal_code,
        profile.city,
        profile.municipality,
        profile.quality_score,
        profile.publication_status,
        location.latitude::float8 as latitude,
        location.longitude::float8 as longitude
      from company_directory_profiles profile
      join company_directory_profile_services relation
        on relation.profile_id = profile.id
       and relation.is_active = true
       and relation.public_visible = true
      join company_directory_services service
        on service.slug = relation.service_slug
       and service.is_active = true
      left join company_directory_business_locations location
        on location.profile_id = profile.id
       and location.is_public = true
      where profile.publication_status in ('ready', 'published')
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (${serviceSlug} = '' or relation.service_slug = ${serviceSlug})
        and (${categorySlug} = '' or service.category_slug = ${categorySlug})
        and (
          ${normalizedLocation} = ''
          or lower(profile.city) = ${normalizedLocation}
          or lower(profile.municipality) = ${normalizedLocation}
        )
        and (
          ${streetAddressOnly} = false
          or (
            profile.address_line1 <> ''
            and lower(profile.address_line1) not like 'box %'
            and lower(profile.address_line1) not like 'kivra:%'
          )
        )
        and (
          ${requireCoordinates} = false
          or (location.latitude is not null and location.longitude is not null)
        )
    ), ranked as (
      select
        matches.*,
        case
          when ${nearbyEnabled} = true and latitude is not null and longitude is not null then
            6371 * 2 * asin(
              sqrt(
                least(
                  1,
                  power(sin(radians(latitude - ${originLatitude}) / 2), 2)
                  + cos(radians(${originLatitude}))
                  * cos(radians(latitude))
                  * power(sin(radians(longitude - ${originLongitude}) / 2), 2)
                )
              )
            )
          else null
        end as distance_km
      from matches
    )
    select *
    from ranked
    where ${nearbyEnabled} = false or distance_km <= ${radiusKm}
    order by
      case when ${nearbyEnabled} = true then distance_km end asc nulls last,
      case when publication_status = 'published' then 0 else 1 end,
      quality_score desc,
      display_name asc
    limit ${limit}
  `;

  return {
    serviceQuery,
    locationQuery,
    serviceResolved: true,
    nearbyRequested,
    nearbyEnabled,
    radiusKm,
    results: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.public_slug),
      companyName: String(row.display_name),
      categorySlug: String(row.category_slug),
      serviceSlug: String(row.service_slug),
      serviceLabel: String(row.service_label),
      addressLine1: String(row.address_line1 ?? ""),
      postalCode: String(row.postal_code ?? ""),
      city: String(row.city ?? ""),
      municipality: String(row.municipality ?? ""),
      qualityScore: Number(row.quality_score ?? 0),
      publicationStatus: String(row.publication_status ?? ""),
      latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
      distanceKm: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
    })),
  };
}
