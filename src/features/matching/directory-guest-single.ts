import "server-only";

import {
  directoryGuestMatchRadius,
  rankDirectoryGuestCandidates,
  type DirectoryGuestLeadMatch,
  type DirectoryGuestOffer,
} from "./directory-guest";
import { getSql } from "@/lib/db/server";
import { serviceCategoryForQuoteCategory } from "@/lib/service-catalog";

type GuestLead = DirectoryGuestLeadMatch["lead"];
type CandidateRows = Parameters<typeof rankDirectoryGuestCandidates>[1];

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

function normalizeLead(row: Record<string, unknown>): GuestLead {
  return {
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
  };
}

function normalizeOffer(row: Record<string, unknown>): DirectoryGuestOffer {
  return {
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
}

export async function getDirectoryGuestLeadMatch(quoteRequestId: string) {
  const sql = getSql();
  if (!sql) {
    return {
      ok: false as const,
      message: "Databasen är inte konfigurerad.",
      match: null as DirectoryGuestLeadMatch | null,
    };
  }

  try {
    const leadRows = await sql`
      select
        request.id::text,
        request.reference_id,
        request.category,
        request.service_type,
        request.city,
        request.postal_code,
        request.description,
        request.status,
        coalesce(
          nullif(to_jsonb(request)->>'customer_verified_latitude', '')::float8,
          request.customer_latitude::float8
        ) as customer_latitude,
        coalesce(
          nullif(to_jsonb(request)->>'customer_verified_longitude', '')::float8,
          request.customer_longitude::float8
        ) as customer_longitude,
        request.created_at::text
      from quote_requests request
      where request.id = ${quoteRequestId}::uuid
        and request.status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
      limit 1
    `;

    const leadRow = (leadRows as Record<string, unknown>[])[0];
    if (!leadRow) return { ok: true as const, match: null as DirectoryGuestLeadMatch | null };
    const lead = normalizeLead(leadRow);

    const offerRows = await sql`
      select
        offer.id::text as offer_id,
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
      where offer.quote_request_id = ${quoteRequestId}::uuid
      order by offer.submitted_at desc, offer.id desc
    `;
    const offers = (offerRows as Record<string, unknown>[]).map(normalizeOffer);

    const requiredCategory = serviceCategoryForQuoteCategory(lead.category);
    if (!requiredCategory) {
      return { ok: true as const, match: { lead, candidates: [], offers, radiusKm: null } };
    }

    const origin = leadCoordinates(lead);
    const originLatitude = origin?.latitude ?? null;
    const originLongitude = origin?.longitude ?? null;
    const locality = text(lead.city).toLocaleLowerCase("sv-SE");
    if (!origin && !locality) {
      return { ok: true as const, match: { lead, candidates: [], offers, radiusKm: null } };
    }

    const candidateRows = await sql`
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
        scb.conflicts as scb_conflicts
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
        and profile.category_slug = ${requiredCategory}
        and profile.claimed_workspace_id is null
        and profile.organization_kind = 'juridical_person'
        and profile.is_active = true
        and profile.privacy_blocked = false
        and (
          (
            ${originLatitude}::float8 is not null
            and ${originLongitude}::float8 is not null
            and location.latitude is not null
            and location.longitude is not null
            and 6371 * 2 * asin(
              sqrt(
                least(
                  1,
                  power(sin(radians(location.latitude - ${originLatitude}::float8) / 2), 2)
                  + cos(radians(${originLatitude}::float8))
                  * cos(radians(location.latitude))
                  * power(sin(radians(location.longitude - ${originLongitude}::float8) / 2), 2)
                )
              )
            ) <= 50
          )
          or (
            ${originLatitude}::float8 is null
            and (
              lower(btrim(profile.city)) = ${locality}
              or lower(btrim(profile.municipality)) = ${locality}
            )
          )
        )
      order by profile.quality_score desc, profile.display_name asc, relation.service_slug asc
      limit 500
    `;

    const candidatesInput = (candidateRows as Record<string, unknown>[]).map((row) => ({
      profileId: text(row.profile_id),
      slug: text(row.public_slug),
      companyName: text(row.display_name),
      city: text(row.city),
      municipality: text(row.municipality),
      categorySlug: text(row.category_slug),
      serviceSlug: text(row.service_slug),
      serviceName: text(row.service_name),
      serviceCategory: text(row.service_category),
      qualityScore: Number(row.quality_score ?? 0),
      latitude: finiteCoordinate(row.latitude, -90, 90),
      longitude: finiteCoordinate(row.longitude, -180, 180),
      serviceAreaRadiusKm: finiteRadius(row.service_area_radius_km),
      recipientEmail: text(row.recipient_email),
      scbConflicts: row.scb_conflicts as CandidateRows[number]["scbConflicts"],
    })) satisfies CandidateRows;

    const candidates = rankDirectoryGuestCandidates(lead, candidatesInput);
    return {
      ok: true as const,
      match: {
        lead,
        candidates,
        offers,
        radiusKm: directoryGuestMatchRadius(candidates),
      },
    };
  } catch (error) {
    console.error("Failed to load Marketplace match for quote request", { quoteRequestId, error });
    return {
      ok: false as const,
      message: "Kunde inte läsa gästmatchningen.",
      match: null as DirectoryGuestLeadMatch | null,
    };
  }
}
