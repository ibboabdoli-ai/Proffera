import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";

export type PublishedDirectorySearchInput = {
  service?: string;
  location?: string;
  limit?: number;
};

export type PublishedDirectorySearchResult = {
  id: string;
  slug: string;
  companyName: string;
  categorySlug: string;
  matchedServiceSlug: string;
  matchedServiceLabel: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
};

export type PublishedDirectorySearchResponse = {
  serviceQuery: string;
  locationQuery: string;
  serviceResolved: boolean;
  results: PublishedDirectorySearchResult[];
};

function cleanSearchValue(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
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

  const emptyResponse = (serviceResolved: boolean): PublishedDirectorySearchResponse => ({
    serviceQuery,
    locationQuery,
    serviceResolved,
    results: [],
  });

  if (!sql) return emptyResponse(!serviceQuery || Boolean(resolution));
  if (serviceQuery && !resolution) return emptyResponse(false);

  const serviceSlug = resolution?.kind === "service" ? resolution.serviceSlug : "";
  const categorySlug = resolution?.categorySlug ?? "";

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
      where profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (${serviceSlug} = '' or relation.service_slug = ${serviceSlug})
        and (${categorySlug} = '' or service.category_slug = ${categorySlug})
        and (
          ${normalizedLocation} = ''
          or lower(profile.city) = ${normalizedLocation}
          or lower(profile.municipality) = ${normalizedLocation}
        )
    )
    select *
    from matches
    where match_rank = 1
    order by quality_score desc, display_name asc
    limit ${limit}
  `;

  return {
    serviceQuery,
    locationQuery,
    serviceResolved: true,
    results: rows.map((row) => ({
      id: String(row.id),
      slug: String(row.public_slug),
      companyName: String(row.display_name),
      categorySlug: String(row.category_slug),
      matchedServiceSlug: String(row.service_slug),
      matchedServiceLabel: String(row.service_label),
      addressLine1: String(row.address_line1 ?? ""),
      postalCode: String(row.postal_code ?? ""),
      city: String(row.city ?? ""),
      municipality: String(row.municipality ?? ""),
    })),
  };
}
