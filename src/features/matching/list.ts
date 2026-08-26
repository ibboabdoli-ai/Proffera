import { getSql } from "@/lib/db/server";
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

function toCandidate(row: Record<string, unknown>): WorkspaceLeadCandidate {
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
      select id, reference_id, category, service_type, city, postal_code, description, status, created_at
      from quote_requests
      where status in (
        ${submittedStatus},
        ${pendingReviewStatus},
        ${approvedStatus},
        ${matchedStatus},
        ${answeredStatus}
      )
      order by created_at desc
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
        claim.status as claim_status,
        claim.verified_at as claim_verified_at,
        claim.resolved_at as claim_resolved_at,
        service.id::text as service_id,
        service.name as service_name,
        service.category as service_category,
        case when confirmed_area.radius_km is not null then service.service_area else '' end as service_area,
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
    const matches = (leads as LeadRow[]).map((lead) => ({
      lead,
      suggestions: buildWorkspaceLeadSuggestions(lead, candidates),
    }));

    return { ok: true as const, matches };
  } catch (error) {
    console.error("Failed to read workspace lead matches", error);
    return { ok: false as const, message: "Kunde inte läsa matchningar.", matches: [] as LeadMatch[] };
  }
}
