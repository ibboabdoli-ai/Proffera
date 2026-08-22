import "server-only";

import { businessEmailDomainKind, validBusinessEmail } from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";
import { serviceCategoryForQuoteCategory } from "@/lib/service-catalog";

type GuestLead = {
  id: string;
  reference_id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  status: string;
  customer_latitude: number | null;
  customer_longitude: number | null;
  created_at: string;
};

export type DirectoryGuestCandidate = {
  profileId: string;
  slug: string;
  companyName: string;
  city: string;
  municipality: string;
  serviceSlug: string;
  serviceName: string;
  serviceCategory: string;
  qualityScore: number;
  score: number;
  reasons: string[];
  distanceKm: number | null;
  serviceAreaRadiusKm: number | null;
  serviceAreaConfirmed: boolean;
  recipientEmail: string;
  contactBasis: "official_business_register" | null;
};

export type DirectoryGuestOffer = {
  offerId: string;
  companyName: string;
  profileSlug: string;
  status: string;
  priceKind: string;
  currency: string;
  amountMinor: number;
  availableDate: string;
  companyNote: string;
  submittedAt: string;
};

export type DirectoryGuestLeadMatch = {
  lead: GuestLead;
  candidates: DirectoryGuestCandidate[];
  offers: DirectoryGuestOffer[];
  radiusKm: number | null;
};

type PreparedText = {
  normalized: string;
  tokens: string[];
};

type CandidateRow = {
  profileId: string;
  slug: string;
  companyName: string;
  city: string;
  municipality: string;
  categorySlug: string;
  serviceSlug: string;
  serviceName: string;
  serviceCategory: string;
  qualityScore: number;
  latitude?: number | null;
  longitude?: number | null;
  serviceAreaRadiusKm?: number | null;
  recipientEmail?: string;
  scbConflicts?: unknown;
};

export const MIN_AUTOMATION_SCORE = 70;
const MATCH_RADII_KM = [10, 25, 50] as const;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function finiteRadius(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 300 ? parsed : null;
}

function leadCoordinates(lead: Pick<GuestLead, "customer_latitude" | "customer_longitude">) {
  const latitude = finiteCoordinate(lead.customer_latitude, -90, 90);
  const longitude = finiteCoordinate(lead.customer_longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function haversineDistanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(latitude2 - latitude1);
  const deltaLongitude = radians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prepare(value: string): PreparedText {
  const normalized = normalize(value);
  return {
    normalized,
    tokens: normalized.split(/\s+/).filter((token) => token.length >= 4),
  };
}

function overlapsPrepared(left: PreparedText, right: PreparedText) {
  if (!left.normalized || !right.normalized) return false;
  if (left.normalized === right.normalized) return true;

  const shortestLength = Math.min(left.normalized.length, right.normalized.length);
  if (
    shortestLength >= 5
    && (left.normalized.includes(right.normalized) || right.normalized.includes(left.normalized))
  ) {
    return true;
  }

  return left.tokens.some((leftToken) => right.tokens.some((rightToken) => {
    const shortest = Math.min(leftToken.length, rightToken.length);
    const prefixLength = Math.min(7, shortest);
    return prefixLength >= 5 && leftToken.slice(0, prefixLength) === rightToken.slice(0, prefixLength);
  }));
}

function genericService(prepared: PreparedText) {
  return prepared.normalized.startsWith("annat ")
    || prepared.normalized.startsWith("annan ")
    || prepared.normalized.startsWith("ovrig ");
}

function hasScbConflicts(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return true;
  }
}

function safeOfficialRecipient(row: CandidateRow) {
  const email = text(row.recipientEmail).toLowerCase();
  if (!email || hasScbConflicts(row.scbConflicts)) return "";
  if (!validBusinessEmail(email) || businessEmailDomainKind(email) !== "business_domain") return "";
  return email;
}

export function rankDirectoryGuestCandidates(
  lead: Pick<GuestLead, "category" | "service_type" | "city"> & Partial<Pick<GuestLead, "customer_latitude" | "customer_longitude">>,
  rows: CandidateRow[],
) {
  const expectedCategory = serviceCategoryForQuoteCategory(lead.category);
  if (!expectedCategory) return [] as DirectoryGuestCandidate[];

  const preparedLeadCity = prepare(lead.city);
  const preparedLeadService = prepare(lead.service_type);
  const preparedLeadCategory = prepare(lead.category);
  const leadHasCity = Boolean(preparedLeadCity.normalized);
  const leadHasGenericService = genericService(preparedLeadService);
  const origin = leadCoordinates({
    customer_latitude: lead.customer_latitude ?? null,
    customer_longitude: lead.customer_longitude ?? null,
  });

  const best = new Map<string, DirectoryGuestCandidate>();
  for (const row of rows) {
    if (row.categorySlug !== expectedCategory) continue;

    const preparedRowCity = prepare(row.city);
    const preparedRowMunicipality = prepare(row.municipality);
    const textualLocal = !leadHasCity
      || overlapsPrepared(preparedRowCity, preparedLeadCity)
      || overlapsPrepared(preparedRowMunicipality, preparedLeadCity);

    const rowLatitude = finiteCoordinate(row.latitude, -90, 90);
    const rowLongitude = finiteCoordinate(row.longitude, -180, 180);
    let distanceKm: number | null = null;
    if (origin) {
      if (rowLatitude === null || rowLongitude === null) continue;
      distanceKm = haversineDistanceKm(origin.latitude, origin.longitude, rowLatitude, rowLongitude);
      if (distanceKm > MATCH_RADII_KM[MATCH_RADII_KM.length - 1]) continue;
    } else if (!textualLocal) {
      continue;
    }

    const preparedServiceName = prepare(row.serviceName);
    const preparedServiceCategory = prepare(row.serviceCategory);
    const specific = overlapsPrepared(preparedServiceName, preparedLeadService);
    const categoryCompatible = overlapsPrepared(preparedServiceName, preparedLeadCategory)
      || overlapsPrepared(preparedServiceCategory, preparedLeadCategory);
    if (!specific && !leadHasGenericService && !categoryCompatible) continue;
    if (lead.category === "Städning" && !specific && !leadHasGenericService) continue;

    const serviceAreaRadiusKm = finiteRadius(row.serviceAreaRadiusKm);
    if (distanceKm !== null && serviceAreaRadiusKm !== null && distanceKm > serviceAreaRadiusKm) continue;
    const serviceAreaConfirmed = distanceKm !== null && serviceAreaRadiusKm !== null;

    let score = 45;
    const reasons = ["publicerad företagsprofil", "rätt kategori"];
    if (specific) {
      score += 25;
      reasons.push("tjänstmatch");
    } else {
      score += 15;
      reasons.push("kategorimatch");
    }

    if (distanceKm !== null) {
      if (distanceKm <= 10) score += 15;
      else if (distanceKm <= 25) score += 10;
      else score += 5;
      reasons.push(`${distanceKm.toFixed(1)} km bort`);
      if (serviceAreaConfirmed) {
        score += 10;
        reasons.push("bekräftat serviceområde");
      } else {
        reasons.push("serviceområde ej bekräftat");
      }
    } else if (leadHasCity) {
      score += 10;
      reasons.push("lokal kandidat – serviceområde ej bekräftat");
    }

    score += Math.min(15, Math.max(0, Math.round(row.qualityScore * 0.15)));
    const recipientEmail = safeOfficialRecipient(row);
    if (recipientEmail) reasons.push("officiell företagskontakt tillgänglig");

    const candidate: DirectoryGuestCandidate = {
      profileId: row.profileId,
      slug: row.slug,
      companyName: row.companyName,
      city: row.city,
      municipality: row.municipality,
      serviceSlug: row.serviceSlug,
      serviceName: row.serviceName,
      serviceCategory: row.serviceCategory,
      qualityScore: row.qualityScore,
      score: Math.min(100, score),
      reasons,
      distanceKm,
      serviceAreaRadiusKm,
      serviceAreaConfirmed,
      recipientEmail,
      contactBasis: recipientEmail ? "official_business_register" : null,
    };
    const existing = best.get(row.profileId);
    if (!existing || candidate.score > existing.score) best.set(row.profileId, candidate);
  }

  const ranked = [...best.values()]
    .filter((candidate) => candidate.score >= MIN_AUTOMATION_SCORE)
    .sort((left, right) => right.score - left.score
      || (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY)
      || right.qualityScore - left.qualityScore
      || left.companyName.localeCompare(right.companyName, "sv"));

  if (!origin) return ranked.slice(0, 5);

  const selectedRadius = MATCH_RADII_KM.find((radius) => ranked.filter((candidate) => (candidate.distanceKm ?? Infinity) <= radius).length >= 3)
    ?? MATCH_RADII_KM[MATCH_RADII_KM.length - 1];
  return ranked.filter((candidate) => (candidate.distanceKm ?? Infinity) <= selectedRadius).slice(0, 5);
}

export function directoryGuestMatchRadius(candidates: DirectoryGuestCandidate[]) {
  const distances = candidates.map((candidate) => candidate.distanceKm).filter((value): value is number => value !== null);
  if (distances.length === 0) return null;
  const furthest = Math.max(...distances);
  return MATCH_RADII_KM.find((radius) => furthest <= radius) ?? 50;
}

export async function getDirectoryGuestLeadMatches() {
  const sql = getSql();
  if (!sql) return { ok: false as const, message: "Databasen är inte konfigurerad.", matches: [] as DirectoryGuestLeadMatch[] };

  try {
    const leads = await sql`
      select
        id::text,
        reference_id,
        category,
        service_type,
        city,
        postal_code,
        description,
        status,
        customer_latitude::float8,
        customer_longitude::float8,
        created_at::text
      from quote_requests
      where status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
      order by created_at desc
      limit 50
    `;

    const typedLeads = (leads as Record<string, unknown>[]).map((row) => ({
      ...row,
      id: text(row.id),
      reference_id: text(row.reference_id),
      category: text(row.category),
      service_type: text(row.service_type),
      city: text(row.city),
      postal_code: text(row.postal_code),
      description: text(row.description),
      status: text(row.status),
      customer_latitude: finiteCoordinate(row.customer_latitude, -90, 90),
      customer_longitude: finiteCoordinate(row.customer_longitude, -180, 180),
      created_at: text(row.created_at),
    })) as GuestLead[];
    if (typedLeads.length === 0) {
      return { ok: true as const, matches: [] as DirectoryGuestLeadMatch[] };
    }

    const leadIdCsv = typedLeads.map((lead) => lead.id).join(",");
    const offerRows = await sql`
      select
        offer.id::text as offer_id,
        offer.quote_request_id::text as quote_request_id,
        offer.status,
        offer.price_kind,
        offer.currency,
        offer.amount_minor,
        offer.available_date::text,
        offer.company_note,
        offer.submitted_at::text,
        profile.display_name,
        profile.public_slug
      from marketplace_quote_offers offer
      join marketplace_quote_invitations invitation on invitation.id = offer.invitation_id
      join company_directory_profiles profile on profile.id = offer.profile_id
      where offer.quote_request_id = any(string_to_array(${leadIdCsv}, ',')::uuid[])
      order by offer.submitted_at desc, offer.id desc
    `;

    const offersByQuote = new Map<string, DirectoryGuestOffer[]>();
    for (const row of offerRows as Record<string, unknown>[]) {
      const quoteRequestId = text(row.quote_request_id);
      if (!quoteRequestId) continue;
      const offer: DirectoryGuestOffer = {
        offerId: text(row.offer_id),
        companyName: text(row.display_name),
        profileSlug: text(row.public_slug),
        status: text(row.status),
        priceKind: text(row.price_kind),
        currency: text(row.currency) || "SEK",
        amountMinor: Number(row.amount_minor ?? 0),
        availableDate: text(row.available_date),
        companyNote: text(row.company_note),
        submittedAt: text(row.submitted_at),
      };
      const bucket = offersByQuote.get(quoteRequestId) ?? [];
      bucket.push(offer);
      offersByQuote.set(quoteRequestId, bucket);
    }

    const requiredCategories = new Set<string>();
    for (const lead of typedLeads) {
      const category = serviceCategoryForQuoteCategory(lead.category);
      if (category) requiredCategories.add(category);
    }
    if (requiredCategories.size === 0) {
      return {
        ok: true as const,
        matches: typedLeads.map((lead) => ({ lead, candidates: [], offers: offersByQuote.get(lead.id) ?? [], radiusKm: null })),
      };
    }

    const requiredCategoryCsv = [...requiredCategories].join(",");
    const requiredLocalities = [...new Set(
      typedLeads.map((lead) => text(lead.city).toLocaleLowerCase("sv-SE")).filter(Boolean),
    )];
    const requiredLocalitiesJson = JSON.stringify(requiredLocalities);
    const requiredPoints = typedLeads
      .map((lead) => leadCoordinates(lead))
      .filter((point): point is { latitude: number; longitude: number } => point !== null);
    const requiredPointsJson = JSON.stringify(requiredPoints);

    const candidates = await sql`
      with required_localities as (
        select value as locality
        from jsonb_array_elements_text(${requiredLocalitiesJson}::jsonb)
      ), required_points as (
        select
          (point->>'latitude')::float8 as latitude,
          (point->>'longitude')::float8 as longitude
        from jsonb_array_elements(${requiredPointsJson}::jsonb) as point
      ), ranked_candidates as (
        select
          profile.id::text as profile_id,
          profile.public_slug,
          profile.display_name,
          profile.city,
          profile.municipality,
          profile.category_slug,
          profile.quality_score,
          relation.service_slug,
          service.label as service_name,
          category.label as service_category,
          location.latitude::float8 as latitude,
          location.longitude::float8 as longitude,
          service_area.radius_km::float8 as service_area_radius_km,
          scb.email as recipient_email,
          scb.conflicts as scb_conflicts,
          row_number() over (
            partition by
              profile.category_slug,
              coalesce(nullif(lower(btrim(profile.city)), ''), nullif(lower(btrim(profile.municipality)), ''), '__unknown__'),
              relation.service_slug
            order by profile.quality_score desc, profile.display_name asc, profile.id asc
          ) as locality_service_rank
        from company_directory_profiles profile
        join company_directory_profile_services relation
          on relation.profile_id = profile.id
         and relation.is_active = true
         and relation.public_visible = true
        join company_directory_services service
          on service.slug = relation.service_slug
         and service.is_active = true
        join company_directory_service_categories category
          on category.slug = service.category_slug
         and category.is_active = true
        left join company_directory_business_locations location
          on location.profile_id = profile.id
         and location.is_public = true
        left join company_directory_scb_enrichment scb
          on scb.profile_id = profile.id
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
        where profile.publication_status = 'published'
          and profile.category_slug = any(string_to_array(${requiredCategoryCsv}, ','))
          and profile.claimed_workspace_id is null
          and profile.organization_kind = 'juridical_person'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and (
            exists (
              select 1
              from required_localities locality
              where lower(btrim(profile.city)) = locality.locality
                 or lower(btrim(profile.municipality)) = locality.locality
            )
            or exists (
              select 1
              from required_points origin
              where location.latitude is not null
                and location.longitude is not null
                and 6371 * 2 * asin(
                  sqrt(
                    least(
                      1,
                      power(sin(radians(location.latitude - origin.latitude) / 2), 2)
                      + cos(radians(origin.latitude))
                      * cos(radians(location.latitude))
                      * power(sin(radians(location.longitude - origin.longitude) / 2), 2)
                    )
                  )
                ) <= 50
            )
          )
      )
      select
        profile_id,
        public_slug,
        display_name,
        city,
        municipality,
        category_slug,
        quality_score,
        service_slug,
        service_name,
        service_category,
        latitude,
        longitude,
        service_area_radius_km,
        recipient_email,
        scb_conflicts
      from ranked_candidates
      where locality_service_rank <= 100
      order by quality_score desc, display_name asc, service_slug asc
    `;

    const rowsByCategory = new Map<string, CandidateRow[]>();
    for (const row of candidates as Record<string, unknown>[]) {
      const categorySlug = text(row.category_slug);
      if (!requiredCategories.has(categorySlug)) continue;
      const normalizedRow: CandidateRow = {
        profileId: text(row.profile_id),
        slug: text(row.public_slug),
        companyName: text(row.display_name),
        city: text(row.city),
        municipality: text(row.municipality),
        categorySlug,
        serviceSlug: text(row.service_slug),
        serviceName: text(row.service_name),
        serviceCategory: text(row.service_category),
        qualityScore: Number(row.quality_score ?? 0),
        latitude: finiteCoordinate(row.latitude, -90, 90),
        longitude: finiteCoordinate(row.longitude, -180, 180),
        serviceAreaRadiusKm: finiteRadius(row.service_area_radius_km),
        recipientEmail: text(row.recipient_email),
        scbConflicts: row.scb_conflicts,
      };
      const bucket = rowsByCategory.get(categorySlug) ?? [];
      bucket.push(normalizedRow);
      rowsByCategory.set(categorySlug, bucket);
    }

    const matches = typedLeads.map((lead) => {
      const category = serviceCategoryForQuoteCategory(lead.category);
      const candidatesForLead = category ? rankDirectoryGuestCandidates(lead, rowsByCategory.get(category) ?? []) : [];
      return {
        lead,
        candidates: candidatesForLead,
        offers: offersByQuote.get(lead.id) ?? [],
        radiusKm: directoryGuestMatchRadius(candidatesForLead),
      };
    });
    return { ok: true as const, matches };
  } catch (error) {
    console.error("Failed to load guest marketplace candidates", error);
    return { ok: false as const, message: "Kunde inte läsa gästmatchningar.", matches: [] as DirectoryGuestLeadMatch[] };
  }
}
