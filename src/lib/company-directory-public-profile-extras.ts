import "server-only";

import { getSql } from "@/lib/db/server";

export type PublicDirectoryProfileService = {
  slug: string;
  label: string;
  sourceType: string;
  confidence: number;
  confirmed: boolean;
};

export type PublicDirectoryProfileServiceArea = {
  serviceSlug: string;
  serviceLabel: string;
  radiusKm: number;
};

export type PublicDirectoryProfileExtras = {
  services: PublicDirectoryProfileService[];
  serviceAreas: PublicDirectoryProfileServiceArea[];
};

const EMPTY_EXTRAS: PublicDirectoryProfileExtras = { services: [], serviceAreas: [] };

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPublicDirectoryProfileExtras(profileId: string): Promise<PublicDirectoryProfileExtras> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    return EMPTY_EXTRAS;
  }

  const sql = getSql();
  if (!sql) return EMPTY_EXTRAS;

  const [serviceRows, areaRows] = await Promise.all([
    sql`
      select
        service.slug,
        service.label,
        relation.source_type,
        relation.confidence,
        relation.confirmed_at
      from company_directory_profile_services relation
      join company_directory_services service
        on service.slug = relation.service_slug
       and service.is_active = true
      where relation.profile_id = ${profileId}::uuid
        and relation.is_active = true
        and relation.public_visible = true
      order by relation.is_primary desc, service.sort_order asc, service.label asc
    `,
    sql`
      select
        coalesce(area.service_slug, '') as service_slug,
        coalesce(service.label, '') as service_label,
        area.radius_km
      from company_directory_service_areas area
      left join company_directory_services service
        on service.slug = area.service_slug
       and service.is_active = true
      where area.profile_id = ${profileId}::uuid
        and area.public_visible = true
        and area.confirmed_at is not null
      order by area.service_slug nulls first, area.radius_km asc
    `,
  ]);

  return {
    services: serviceRows.map((row) => ({
      slug: text(row.slug),
      label: text(row.label),
      sourceType: text(row.source_type),
      confidence: number(row.confidence),
      confirmed: Boolean(row.confirmed_at),
    })),
    serviceAreas: areaRows
      .map((row) => ({
        serviceSlug: text(row.service_slug),
        serviceLabel: text(row.service_label),
        radiusKm: number(row.radius_km),
      }))
      .filter((area) => area.radiusKm > 0),
  };
}
