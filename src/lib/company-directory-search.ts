import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";

export type CompanyDirectorySearchInput = {
  service?: string;
  location?: string;
  limit?: number;
  streetAddressOnly?: boolean;
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
};

export type CompanyDirectorySearchResponse = {
  serviceQuery: string;
  locationQuery: string;
  serviceResolved: boolean;
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

  if (!sql) {
    return { serviceQuery, locationQuery, serviceResolved: !serviceQuery || Boolean(resolution), results: [] };
  }

  if (serviceQuery && !resolution) {
    return { serviceQuery, locationQuery, serviceResolved: false, results: [] };
  }

  const serviceSlug = resolution?.kind === "service" ? resolution.serviceSlug : "";
  const categorySlug = resolution?.categorySlug ?? "";

  const rows = await sql`
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
      profile.publication_status
    from company_directory_profiles profile
    join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.is_active = true
     and relation.public_visible = true
    join company_directory_services service
      on service.slug = relation.service_slug
     and service.is_active = true
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
    order by
      case when profile.publication_status = 'published' then 0 else 1 end,
      profile.quality_score desc,
      profile.display_name asc
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
      serviceSlug: String(row.service_slug),
      serviceLabel: String(row.service_label),
      addressLine1: String(row.address_line1 ?? ""),
      postalCode: String(row.postal_code ?? ""),
      city: String(row.city ?? ""),
      municipality: String(row.municipality ?? ""),
      qualityScore: Number(row.quality_score ?? 0),
      publicationStatus: String(row.publication_status ?? ""),
    })),
  };
}
