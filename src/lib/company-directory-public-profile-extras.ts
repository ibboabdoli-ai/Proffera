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

export type PublicDirectoryProfileReputation = {
  rating: number;
  verifiedReviews: number;
  completedJobs: number;
  customerCancellations: number;
  providerCancellations: number;
  noShows: number;
  problemJobs: number;
};

export type PublicDirectoryProfileExtras = {
  services: PublicDirectoryProfileService[];
  serviceAreas: PublicDirectoryProfileServiceArea[];
  reputation: PublicDirectoryProfileReputation | null;
};

const EMPTY_EXTRAS: PublicDirectoryProfileExtras = { services: [], serviceAreas: [], reputation: null };

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compatibilityError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
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

  let reputation: PublicDirectoryProfileReputation | null = null;
  try {
    const reputationRows = await sql`
      select
        rating,
        verified_review_count,
        completed_jobs,
        customer_cancelled_jobs,
        provider_cancelled_jobs,
        no_show_jobs,
        problem_jobs
      from marketplace_profile_reputation
      where profile_id = ${profileId}::uuid
      limit 1
    `;
    const row = reputationRows[0];
    if (row) {
      reputation = {
        rating: number(row.rating),
        verifiedReviews: number(row.verified_review_count),
        completedJobs: number(row.completed_jobs),
        customerCancellations: number(row.customer_cancelled_jobs),
        providerCancellations: number(row.provider_cancelled_jobs),
        noShows: number(row.no_show_jobs),
        problemJobs: number(row.problem_jobs),
      };
    }
  } catch (error) {
    if (!compatibilityError(error)) throw error;
  }

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
    reputation,
  };
}
