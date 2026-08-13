import "server-only";

import { normalizeDirectoryRadiusKm, parseDirectoryCoordinates } from "@/lib/company-directory-distance";
import { getSql } from "@/lib/db/server";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";

export type PublishedDirectorySearchInput = {
  service?: string;
  location?: string;
  limit?: number;
  latitude?: number | string;
  longitude?: number | string;
  radiusKm?: number | string;
};

export type PublishedDirectorySearchResult = {
  id: string;
  slug: string;
  companyName: string;
  categorySlug: string;
  matchedServiceSlug: string;
  matchedServiceLabel: string;
  activityDescription: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  qualityScore: number;
  distanceKm: number | null;
};

export type PublishedDirectorySearchResponse = {
  serviceQuery: string;
  locationQuery: string;
  serviceResolved: boolean;
  nearbyRequested: boolean;
  nearbyEnabled: boolean;
  radiusKm: number;
  results: PublishedDirectorySearchResult[];
};

function cleanSearchValue(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function boundedLimit(value: unknown, fallback = 30, maximum = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

export async function getPublishedDirectoryLocationSuggestions(limit = 50) {
  const sql = getSql();
  if (!sql) return [] as string[];
  const safeLimit = boundedLimit(limit, 50, 100);

  const rows = await sql`
    select location_label
    from (
      select distinct nullif(trim(profile.city), '') as location_label
      from company_directory_profiles profile
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
      union
      select distinct nullif(trim(profile.municipality), '') as location_label
      from company_directory_profiles profile
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
    ) locations
    where location_label is not null
    order by location_label asc
    limit ${safeLimit}
  `;

  return rows.map((row) => String(row.location_label));
}

export async function searchPublishedCompanyDirectory(
  input: PublishedDirectorySearchInput = {},
): Promise<PublishedDirectorySearchResponse> {
  const sql = getSql();
  const serviceQuery = cleanSearchValue(input.service);
  const locationQuery = cleanSearchValue(input.location);
  const normalizedLocation = locationQuery.toLocaleLowerCase("sv-SE");
  const resolution = serviceQuery ? resolveDirectoryServiceQuery(serviceQuery) : null;
  const limit = boundedLimit(input.limit);
  const coordinates = parseDirectoryCoordinates(input.latitude, input.longitude);
  const nearbyRequested = input.latitude !== undefined || input.longitude !== undefined;
  const nearbyEnabled = coordinates !== null;
  const radiusKm = normalizeDirectoryRadiusKm(input.radiusKm, 25);

  const emptyResponse = (serviceResolved: boolean): PublishedDirectorySearchResponse => ({
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
        profile.activity_description,
        profile.address_line1,
        profile.postal_code,
        profile.city,
        profile.municipality,
        profile.quality_score,
        location.latitude::float8 as latitude,
        location.longitude::float8 as longitude,
        row_number() over (
          partition by profile.id
          order by service.label asc, relation.service_slug asc
        ) as match_rank
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
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (${serviceSlug} = '' or relation.service_slug = ${serviceSlug})
        and (${categorySlug} = '' or service.category_slug = ${categorySlug})
        and (
          ${nearbyEnabled} = true
          or ${normalizedLocation} = ''
          or lower(profile.city) = ${normalizedLocation}
          or lower(profile.municipality) = ${normalizedLocation}
        )
        and (
          ${nearbyEnabled} = false
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
      where match_rank = 1
    )
    select *
    from ranked
    where ${nearbyEnabled} = false or distance_km <= ${radiusKm}
    order by
      case when ${nearbyEnabled} = true then distance_km end asc nulls last,
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
      matchedServiceSlug: String(row.service_slug),
      matchedServiceLabel: String(row.service_label),
      activityDescription: String(row.activity_description ?? ""),
      addressLine1: String(row.address_line1 ?? ""),
      postalCode: String(row.postal_code ?? ""),
      city: String(row.city ?? ""),
      municipality: String(row.municipality ?? ""),
      qualityScore: Number(row.quality_score ?? 0),
      distanceKm: row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km),
    })),
  };
}
