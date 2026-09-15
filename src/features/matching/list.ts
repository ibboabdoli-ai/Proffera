import { getSql } from "@/lib/db/server";
import { selectClaimedProviderMatchingOrigin } from "@/lib/company-directory-claimed-provider-origin";
import { isVerifiedDirectoryMarketplaceLocation } from "@/lib/company-directory-marketplace-readiness";
import { QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES } from "@/lib/quote-request-lifecycle";
import {
  buildWorkspaceLeadSuggestions,
  type WorkspaceLeadCandidate,
  type WorkspaceLeadSuggestion,
} from "@/features/matching/policy";

type LeadRow = {
  id: string;
  reference_id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  status: string;
  created_at: string;
};

type InternalLeadRow = LeadRow & {
  customer_latitude: unknown;
  customer_longitude: unknown;
};

export type LeadMatch = {
  lead: LeadRow;
  suggestions: WorkspaceLeadSuggestion[];
};

const [
  submittedStatus,
  pendingReviewStatus,
  approvedStatus,
  matchedStatus,
  answeredStatus,
] = QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES;

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function asNullableText(value: unknown) {
  const text = asText(value).trim();
  return text || null;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCandidate(row: Record<string, unknown>): WorkspaceLeadCandidate {
  const canonical = {
    providerPointVerified: isVerifiedDirectoryMarketplaceLocation({
      latitude: row.provider_latitude,
      longitude: row.provider_longitude,
      geocodeSource: row.geocode_source,
      geocodePrecision: row.geocode_precision,
      geocodeConfidence: row.geocode_confidence,
      geocodedAt: row.geocoded_at,
      locationIsPublic: row.location_is_public,
    }),
  };
  const origin = selectClaimedProviderMatchingOrigin({
    claimedWorkspaceId: row.workspace_id,
    serviceBase: row.service_base_candidate_count === null || row.service_base_candidate_count === undefined
      ? null
      : {
          candidateCount: row.service_base_candidate_count,
          ownerWorkspaceId: row.service_base_owner_workspace_id,
          sourceType: row.service_base_source_type,
          purpose: row.service_base_purpose,
          isActive: row.service_base_is_active,
          confirmedAt: row.service_base_confirmed_at,
          latitude: row.service_base_latitude,
          longitude: row.service_base_longitude,
          geocodeSource: row.service_base_geocode_source,
          geocodePrecision: row.service_base_geocode_precision,
          city: row.service_base_city,
          municipality: row.service_base_municipality,
        },
    canonical: {
      latitude: row.provider_latitude,
      longitude: row.provider_longitude,
      city: row.provider_city,
      municipality: row.provider_municipality,
      pointVerified: canonical.providerPointVerified,
    },
  });

  return {
    workspaceId: asText(row.workspace_id),
    companyName: asText(row.company_name),
    primaryCity: asText(row.primary_city),
    email: asText(row.email),
    phone: asText(row.phone),
    workspaceStatus: asText(row.workspace_status),
    claimedProfileId: asText(row.claimed_profile_id),
    claimedProfileCategorySlug: asText(row.claimed_profile_category_slug),
    claimedProfileIsActive: Boolean(row.claimed_profile_is_active),
    claimedProfilePrivacyBlocked: Boolean(row.claimed_profile_privacy_blocked),
    claimStatus: asText(row.claim_status),
    claimVerifiedAt: asNullableText(row.claim_verified_at),
    claimResolvedAt: asNullableText(row.claim_resolved_at),
    serviceId: asText(row.service_id),
    serviceName: asText(row.service_name),
    serviceCategory: asText(row.service_category),
    serviceArea: asText(row.service_area),
    serviceAreaRadiusKm: asNullableNumber(row.service_area_radius_km),
    providerLatitude: origin.latitude,
    providerLongitude: origin.longitude,
    providerPointVerified: origin.pointVerified,
    providerCity: origin.city,
    providerMunicipality: origin.municipality,
    serviceIsActive: Boolean(row.service_is_active),
    servicePublicStatus: asText(row.service_public_status),
    serviceConversionMode: asText(row.service_conversion_mode),
    featureMinimumPlan: row.feature_minimum_plan,
    workspaceFeatureEnabled: Boolean(row.workspace_feature_enabled),
    adminOverrideEnabled:
      row.admin_override_enabled === null || row.admin_override_enabled === undefined
        ? null
        : Boolean(row.admin_override_enabled),
    planKey: row.plan_key,
    planStatus: row.plan_status,
    planPeriodEnd: row.plan_period_end,
    trialStatus: row.trial_status,
    trialEndsAt: row.trial_ends_at,
  };
}

export async function getLeadMatches() {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad.", matches: [] as LeadMatch[] };
  }

  try {
    const leads = await sql`
      select
        request.id,
        request.reference_id,
        request.category,
        request.service_type,
        request.city,
        request.postal_code,
        request.description,
        request.status,
        request.created_at,
        case
          when nullif(to_jsonb(request)->>'customer_verified_latitude', '') is not null
            and nullif(to_jsonb(request)->>'customer_verified_longitude', '') is not null
          then nullif(to_jsonb(request)->>'customer_verified_latitude', '')::float8
          else request.customer_latitude::float8
        end as customer_latitude,
        case
          when nullif(to_jsonb(request)->>'customer_verified_latitude', '') is not null
            and nullif(to_jsonb(request)->>'customer_verified_longitude', '') is not null
          then nullif(to_jsonb(request)->>'customer_verified_longitude', '')::float8
          else request.customer_longitude::float8
        end as customer_longitude
      from quote_requests request
      where request.status in (
        ${submittedStatus},
        ${pendingReviewStatus},
        ${approvedStatus},
        ${matchedStatus},
        ${answeredStatus}
      )
      order by request.created_at desc
      limit 50
    `;

    const candidateRows = await sql`
      with latest_plan as (
        select distinct on (workspace_id)
          workspace_id, plan_key, status, current_period_end
        from workspace_plans
        order by workspace_id, created_at desc
      ),
      latest_claim as (
        select distinct on (requested_workspace_id)
          requested_workspace_id as workspace_id,
          profile_id,
          status,
          verified_at,
          resolved_at
        from company_directory_claims
        where requested_workspace_id is not null
          and status = 'claimed'
        order by requested_workspace_id, resolved_at desc nulls last, requested_at desc
      )
      select
        workspace.id::text as workspace_id,
        coalesce(nullif(trim(workspace.company_name), ''), nullif(trim(workspace.name), ''), profile.display_name) as company_name,
        coalesce(nullif(trim(workspace.primary_city), ''), nullif(trim(settings.primary_city), ''), profile.city) as primary_city,
        coalesce(nullif(trim(workspace.contact_email), ''), nullif(trim(settings.contact_email), '')) as email,
        coalesce(nullif(trim(workspace.contact_phone), ''), nullif(trim(settings.contact_phone), '')) as phone,
        workspace.status as workspace_status,
        profile.id::text as claimed_profile_id,
        profile.category_slug as claimed_profile_category_slug,
        profile.is_active as claimed_profile_is_active,
        profile.privacy_blocked as claimed_profile_privacy_blocked,
        profile.city as provider_city,
        profile.municipality as provider_municipality,
        claim.status as claim_status,
        claim.verified_at as claim_verified_at,
        claim.resolved_at as claim_resolved_at,
        service.id::text as service_id,
        service.name as service_name,
        service.category as service_category,
        service.service_area as service_area,
        confirmed_area.radius_km::float8 as service_area_radius_km,
        location.latitude::float8 as provider_latitude,
        location.longitude::float8 as provider_longitude,
        location.geocode_source,
        location.geocode_precision,
        location.geocode_confidence,
        location.geocoded_at::text as geocoded_at,
        location.is_public as location_is_public,
        service_base.matching_candidate_count as service_base_candidate_count,
        service_base.owner_workspace_id::text as service_base_owner_workspace_id,
        service_base.source_type as service_base_source_type,
        service_base.purpose as service_base_purpose,
        service_base.is_active as service_base_is_active,
        service_base.confirmed_at::text as service_base_confirmed_at,
        service_base.latitude::float8 as service_base_latitude,
        service_base.longitude::float8 as service_base_longitude,
        service_base.geocode_source as service_base_geocode_source,
        service_base.geocode_precision as service_base_geocode_precision,
        service_base.city as service_base_city,
        service_base.municipality as service_base_municipality,
        service.is_active as service_is_active,
        service.public_status as service_public_status,
        service.conversion_mode as service_conversion_mode,
        catalog.minimum_plan as feature_minimum_plan,
        coalesce(flag.enabled, false) as workspace_feature_enabled,
        override.enabled as admin_override_enabled,
        plan.plan_key,
        plan.status as plan_status,
        plan.current_period_end as plan_period_end,
        trial.status as trial_status,
        trial.ends_at as trial_ends_at
      from workspaces workspace
      join latest_claim claim on claim.workspace_id = workspace.id
      join company_directory_profiles profile
        on profile.id = claim.profile_id
       and profile.claimed_workspace_id = workspace.id
      join workspace_services service
        on service.workspace_id = workspace.id::text
      join feature_catalog catalog
        on catalog.feature_key = 'lead_management'
       and catalog.is_active = true
      left join workspace_settings settings
        on settings.workspace_id = workspace.id::text
      left join workspace_feature_flags flag
        on flag.workspace_id = workspace.id
       and flag.feature_key = catalog.feature_key
      left join workspace_feature_overrides override
        on override.workspace_id = workspace.id
       and override.feature_key = catalog.feature_key
      left join latest_plan plan on plan.workspace_id = workspace.id
      left join workspace_feature_trials trial
        on trial.workspace_id = workspace.id
       and trial.feature_key = catalog.feature_key
      left join company_directory_business_locations location
        on location.profile_id = profile.id
      left join lateral (
        select
          owner_base.owner_workspace_id,
          owner_base.source_type,
          owner_base.purpose,
          owner_base.is_active,
          owner_base.confirmed_at,
          owner_base.latitude,
          owner_base.longitude,
          owner_base.geocode_source,
          owner_base.geocode_precision,
          owner_base.city,
          owner_base.municipality,
          (count(*) over ())::int as matching_candidate_count
        from company_directory_profile_locations owner_base
        where owner_base.profile_id = profile.id
          and profile.claimed_workspace_id is not null
          and owner_base.owner_workspace_id = profile.claimed_workspace_id
          and owner_base.source_type = 'owner'
          and owner_base.purpose = 'service_base'
          and owner_base.is_active = true
          and owner_base.confirmed_at is not null
          and owner_base.latitude is not null
          and owner_base.longitude is not null
          and not (owner_base.latitude = 0 and owner_base.longitude = 0)
          and owner_base.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'
          and owner_base.geocode_precision = 'address'
        order by owner_base.confirmed_at desc, owner_base.id asc
        limit 1
      ) service_base on true
      left join lateral (
        select area.radius_km
        from company_directory_service_areas area
        where area.profile_id = profile.id
          and area.public_visible = true
          and area.confirmed_at is not null
          and area.radius_km between 1 and 300
          and (area.service_slug = service.public_slug or area.service_slug is null)
        order by case when area.service_slug = service.public_slug then 0 else 1 end
        limit 1
      ) confirmed_area on true
      where workspace.status in ('active', 'trial')
        and profile.is_active = true
        and profile.privacy_blocked = false
        and service.is_active = true
        and service.public_status = 'published'
        and service.conversion_mode in ('quote', 'book_or_quote', 'contact')
      order by company_name, service.sort_order, service.name
      limit 2000
    `;

    const candidates = (candidateRows as Record<string, unknown>[]).map(toCandidate);
    const matches = (leads as InternalLeadRow[]).map((rawLead) => {
      const lead: LeadRow = {
        id: rawLead.id,
        reference_id: rawLead.reference_id,
        category: rawLead.category,
        service_type: rawLead.service_type,
        city: rawLead.city,
        postal_code: rawLead.postal_code,
        description: rawLead.description,
        status: rawLead.status,
        created_at: rawLead.created_at,
      };
      return {
        lead,
        suggestions: buildWorkspaceLeadSuggestions({
          category: rawLead.category,
          service_type: rawLead.service_type,
          city: rawLead.city,
          customerLatitude: rawLead.customer_latitude,
          customerLongitude: rawLead.customer_longitude,
        }, candidates),
      };
    });

    return { ok: true as const, matches };
  } catch (error) {
    console.error("Failed to read workspace lead matches", error);
    return { ok: false as const, message: "Kunde inte läsa matchningar.", matches: [] as LeadMatch[] };
  }
}
