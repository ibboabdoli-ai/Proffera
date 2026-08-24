import "server-only";

import { gateDirectoryDirectContact } from "@/lib/company-directory-contact-entitlement";
import { normalizeDirectoryRadiusKm, parseDirectoryCoordinates } from "@/lib/company-directory-distance";
import {
  confirmedCompanyDirectoryServiceAreaCoversSearch,
  normalizeCompanyDirectoryServiceAreaRadius,
} from "@/lib/company-directory-service-area-policy";
import { getSql } from "@/lib/db/server";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";
import { getWorkspaceDirectoryPublicAccessForWorkspaces } from "@/lib/workspace-feature-entitlement-db";

export type DirectoryMarketplaceConversionMode = "book" | "quote" | "book_or_quote" | "contact";
export type DirectorySearchSort = "recommended" | "nearest" | "name";

export type PublishedDirectorySearchInput = {
  service?: string;
  location?: string;
  limit?: number;
  page?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  radiusKm?: number | string;
  sort?: string;
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
  serviceAreaRadiusKm: number | null;
  servesNearbyLocation: boolean;
  claimedWorkspaceSlug: string | null;
  claimedServiceId: string | null;
  claimedServiceSlug: string | null;
  claimedBookingSlug: string | null;
  conversionMode: DirectoryMarketplaceConversionMode | null;
  bookingAvailable: boolean;
};

export type PublishedDirectorySearchResponse = {
  serviceQuery: string;
  locationQuery: string;
  serviceResolved: boolean;
  nearbyRequested: boolean;
  nearbyEnabled: boolean;
  radiusKm: number;
  results: PublishedDirectorySearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function cleanSearchValue(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function boundedLimit(value: unknown, fallback = 30, maximum = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

function boundedPage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export function normalizeDirectorySearchSort(value: unknown, nearbyEnabled: boolean): DirectorySearchSort {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "name") return "name";
  if (normalized === "nearest" && nearbyEnabled) return "nearest";
  return "recommended";
}

function marketplaceConversionMode(value: unknown): DirectoryMarketplaceConversionMode | null {
  return value === "book" || value === "quote" || value === "book_or_quote" || value === "contact"
    ? value
    : null;
}

export async function getPublishedDirectoryLocationSuggestions(limit = 50) {
  const sql = getSql();
  if (!sql) return [] as string[];
  const safeLimit = boundedLimit(limit, 50, 100);

  const rows = await sql`
    with eligible as (
      select
        profile.id,
        profile.address_line1,
        profile.postal_code,
        profile.city,
        profile.municipality,
        profile.claimed_workspace_id,
        scb.workplaces
      from company_directory_profiles profile
      left join company_directory_scb_enrichment scb
        on scb.profile_id = profile.id
       and scb.conflicts = '[]'::jsonb
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
    ), resolved as (
      select
        case
          when claimed_workspace_id is null
            and jsonb_array_length(coalesce(workplaces, '[]'::jsonb)) = 1
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
            and nullif(trim(workplaces -> 0 ->> 'municipality'), '') is not null
          then trim(workplaces -> 0 #>> '{visitingAddress,city}')
          else city
        end as city,
        case
          when claimed_workspace_id is null
            and jsonb_array_length(coalesce(workplaces, '[]'::jsonb)) = 1
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
            and nullif(trim(workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
            and nullif(trim(workplaces -> 0 ->> 'municipality'), '') is not null
          then coalesce(trim(workplaces -> 0 ->> 'municipality'), '')
          else municipality
        end as municipality
      from eligible
    ), locations as (
      select distinct nullif(trim(city), '') as location_label from resolved
      union
      select distinct nullif(trim(municipality), '') as location_label from resolved
    )
    select location_label
    from locations
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
  const pageSize = boundedLimit(input.limit);
  const requestedPage = boundedPage(input.page);
  const coordinates = parseDirectoryCoordinates(input.latitude, input.longitude);
  const nearbyRequested = input.latitude !== undefined || input.longitude !== undefined;
  const nearbyEnabled = coordinates !== null;
  const radiusKm = normalizeDirectoryRadiusKm(input.radiusKm, 25);
  const sort = normalizeDirectorySearchSort(input.sort, nearbyEnabled);

  const emptyResponse = (serviceResolved: boolean): PublishedDirectorySearchResponse => ({
    serviceQuery,
    locationQuery,
    serviceResolved,
    nearbyRequested,
    nearbyEnabled,
    radiusKm,
    results: [],
    totalCount: 0,
    page: 1,
    pageSize,
    totalPages: 0,
  });

  if (!sql) return emptyResponse(!serviceQuery || Boolean(resolution));
  if (serviceQuery && !resolution) return emptyResponse(false);

  const serviceSlug = resolution?.kind === "service" ? resolution.serviceSlug : "";
  const categorySlug = resolution?.categorySlug ?? "";
  const originLatitude = coordinates?.latitude ?? 0;
  const originLongitude = coordinates?.longitude ?? 0;

  const totalRows = await sql`
    with matches as (
      select
        profile.id::text,
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
      left join workspaces claimed_workspace
        on claimed_workspace.id = profile.claimed_workspace_id
      left join company_directory_business_locations location
        on location.profile_id = profile.id
       and location.is_public = true
      left join company_directory_scb_enrichment scb_location
        on scb_location.profile_id = profile.id
       and scb_location.conflicts = '[]'::jsonb
      cross join lateral (
        select (
          profile.claimed_workspace_id is null
          and jsonb_array_length(coalesce(scb_location.workplaces, '[]'::jsonb)) = 1
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 ->> 'municipality'), '') is not null
        ) as use_scb_workplace
      ) location_choice
      cross join lateral (
        select
          case when location_choice.use_scb_workplace
            then trim(scb_location.workplaces -> 0 #>> '{visitingAddress,city}')
            else profile.city
          end as city,
          case when location_choice.use_scb_workplace
            then coalesce(trim(scb_location.workplaces -> 0 ->> 'municipality'), '')
            else profile.municipality
          end as municipality
      ) public_location
      where (
          profile.publication_status = 'published'
          or (
            profile.publication_status = 'claimed'
            and profile.claimed_workspace_id is not null
            and profile.published_at is not null
            and profile.auto_public_eligible = true
            and claimed_workspace.status in ('active', 'trial')
          )
        )
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (${serviceSlug} = '' or relation.service_slug = ${serviceSlug})
        and (${categorySlug} = '' or service.category_slug = ${categorySlug})
        and (
          ${nearbyEnabled} = true
          or ${normalizedLocation} = ''
          or lower(public_location.city) = ${normalizedLocation}
          or lower(public_location.municipality) = ${normalizedLocation}
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
    select count(*)::int as total_count
    from ranked
    where ${nearbyEnabled} = false or distance_km <= ${radiusKm}
  `;

  const totalCount = Number(totalRows[0]?.total_count ?? 0);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  const page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
  const offset = (page - 1) * pageSize;

  if (totalCount === 0) {
    return {
      ...emptyResponse(true),
      page,
    };
  }

  const rows = await sql`
    with matches as (
      select
        profile.id::text,
        profile.public_slug,
        profile.display_name,
        profile.category_slug,
        profile.publication_status,
        relation.service_slug,
        service.label as service_label,
        profile.activity_description,
        public_location.address_line1,
        public_location.postal_code,
        public_location.city,
        public_location.municipality,
        profile.quality_score,
        location.latitude::float8 as latitude,
        location.longitude::float8 as longitude,
        service_area.radius_km::float8 as service_area_radius_km,
        claimed_workspace.id::text as claimed_workspace_id,
        claimed_workspace.slug as claimed_workspace_slug,
        nullif(trim(claimed_workspace.public_booking_slug), '') as claimed_booking_slug,
        claimed_service.id::text as claimed_service_id,
        claimed_service.public_slug as claimed_service_slug,
        claimed_service.conversion_mode as claimed_service_conversion_mode,
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
      left join workspaces claimed_workspace
        on claimed_workspace.id = profile.claimed_workspace_id
      left join workspace_services claimed_service
        on claimed_service.workspace_id = profile.claimed_workspace_id::text
       and claimed_service.is_active = true
       and claimed_service.public_status = 'published'
       and coalesce(claimed_service.primary_directory_service_slug, claimed_service.public_slug) = relation.service_slug
      left join company_directory_business_locations location
        on location.profile_id = profile.id
       and location.is_public = true
      left join company_directory_scb_enrichment scb_location
        on scb_location.profile_id = profile.id
       and scb_location.conflicts = '[]'::jsonb
      cross join lateral (
        select (
          profile.claimed_workspace_id is null
          and jsonb_array_length(coalesce(scb_location.workplaces, '[]'::jsonb)) = 1
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,addressLine}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,postalCode}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 #>> '{visitingAddress,city}'), '') is not null
          and nullif(trim(scb_location.workplaces -> 0 ->> 'municipality'), '') is not null
        ) as use_scb_workplace
      ) location_choice
      cross join lateral (
        select
          case when location_choice.use_scb_workplace
            then trim(scb_location.workplaces -> 0 #>> '{visitingAddress,addressLine}')
            else profile.address_line1
          end as address_line1,
          case when location_choice.use_scb_workplace
            then trim(scb_location.workplaces -> 0 #>> '{visitingAddress,postalCode}')
            else profile.postal_code
          end as postal_code,
          case when location_choice.use_scb_workplace
            then trim(scb_location.workplaces -> 0 #>> '{visitingAddress,city}')
            else profile.city
          end as city,
          case when location_choice.use_scb_workplace
            then coalesce(trim(scb_location.workplaces -> 0 ->> 'municipality'), '')
            else profile.municipality
          end as municipality
      ) public_location
      left join lateral (
        select area.radius_km
        from company_directory_service_areas area
        where area.profile_id = profile.id
          and area.public_visible = true
          and area.confirmed_at is not null
          and area.radius_km between 1 and 300
          and (area.service_slug = relation.service_slug or area.service_slug is null)
        order by case when area.service_slug = relation.service_slug then 0 else 1 end
        limit 1
      ) service_area on true
      where (
          profile.publication_status = 'published'
          or (
            profile.publication_status = 'claimed'
            and profile.claimed_workspace_id is not null
            and profile.published_at is not null
            and profile.auto_public_eligible = true
            and claimed_workspace.status in ('active', 'trial')
          )
        )
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (${serviceSlug} = '' or relation.service_slug = ${serviceSlug})
        and (${categorySlug} = '' or service.category_slug = ${categorySlug})
        and (
          ${nearbyEnabled} = true
          or ${normalizedLocation} = ''
          or lower(public_location.city) = ${normalizedLocation}
          or lower(public_location.municipality) = ${normalizedLocation}
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
      case when ${sort} in ('recommended', 'nearest') and ${nearbyEnabled} = true then distance_km end asc nulls last,
      case when ${sort} in ('recommended', 'nearest') then quality_score end desc nulls last,
      case when ${sort} = 'name' then lower(display_name) end asc nulls last,
      display_name asc,
      id asc
    limit ${pageSize}
    offset ${offset}
  `;

  const claimedWorkspaceIds = [...new Set(
    rows
      .filter((row) => String(row.publication_status) === "claimed")
      .map((row) => String(row.claimed_workspace_id ?? ""))
      .filter(Boolean),
  )];
  const workspaceAccess = await getWorkspaceDirectoryPublicAccessForWorkspaces(claimedWorkspaceIds);

  const results = rows.map((row): PublishedDirectorySearchResult => {
    const isClaimed = String(row.publication_status) === "claimed";
    const claimedWorkspaceId = String(row.claimed_workspace_id ?? "").toLowerCase();
    const access = isClaimed ? workspaceAccess.get(claimedWorkspaceId) : null;
    const conversionMode = marketplaceConversionMode(row.claimed_service_conversion_mode);
    const distanceKm = row.distance_km === null || row.distance_km === undefined ? null : Number(row.distance_km);
    const serviceAreaRadiusKm = normalizeCompanyDirectoryServiceAreaRadius(row.service_area_radius_km);
    const serviceAreaCoversSearch = confirmedCompanyDirectoryServiceAreaCoversSearch({
      radiusKm: serviceAreaRadiusKm,
      nearbyEnabled,
      distanceKm,
    });
    const servesNearbyLocation = nearbyEnabled && serviceAreaCoversSearch;
    const marketplaceAvailable = Boolean(
      isClaimed
      && access?.websiteBuilder
      && row.claimed_workspace_slug
      && row.claimed_service_id
      && row.claimed_service_slug
      && conversionMode
      && serviceAreaCoversSearch,
    );
    const claimedBookingSlug = marketplaceAvailable ? String(row.claimed_booking_slug ?? "") || null : null;
    const directContact = gateDirectoryDirectContact(
      { addressLine1: row.address_line1 },
      Boolean(isClaimed && access?.planAccess),
    );

    return {
      id: String(row.id),
      slug: String(row.public_slug),
      companyName: String(row.display_name),
      categorySlug: String(row.category_slug),
      matchedServiceSlug: String(row.service_slug),
      matchedServiceLabel: String(row.service_label),
      activityDescription: String(row.activity_description ?? ""),
      addressLine1: directContact.addressLine1,
      postalCode: String(row.postal_code ?? ""),
      city: String(row.city ?? ""),
      municipality: String(row.municipality ?? ""),
      qualityScore: Number(row.quality_score ?? 0),
      distanceKm,
      serviceAreaRadiusKm,
      servesNearbyLocation,
      claimedWorkspaceSlug: marketplaceAvailable ? String(row.claimed_workspace_slug) : null,
      claimedServiceId: marketplaceAvailable ? String(row.claimed_service_id) : null,
      claimedServiceSlug: marketplaceAvailable ? String(row.claimed_service_slug) : null,
      claimedBookingSlug,
      conversionMode: marketplaceAvailable ? conversionMode : null,
      bookingAvailable: Boolean(
        marketplaceAvailable
        && access?.onlineBooking
        && claimedBookingSlug
        && (conversionMode === "book" || conversionMode === "book_or_quote"),
      ),
    };
  });

  return {
    serviceQuery,
    locationQuery,
    serviceResolved: true,
    nearbyRequested,
    nearbyEnabled,
    radiusKm,
    results,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
