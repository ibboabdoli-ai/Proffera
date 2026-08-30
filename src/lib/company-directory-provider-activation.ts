import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import {
  isProviderMarketplaceConversionMode,
  normalizeProviderServiceAreaRadius,
  normalizeSwedishOrganizationNumber,
  type ProviderMarketplaceConversionMode,
} from "@/lib/company-directory-provider-activation-policy";
import {
  getDirectoryServiceDefinition,
  resolveDirectoryServiceQuery,
} from "@/lib/company-directory-service-taxonomy";

const SOLE_TRADER_OWNER_SOURCE = "bolagsverket_vardefulla_datamangder:sole_trader_owner";
const SOLE_TRADER_SURROGATE_IDENTITY = /^sole-trader-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProviderActivationDirectoryService = {
  slug: string;
  label: string;
};

export type ProviderActivationState = {
  workspaceId: string;
  workspaceName: string;
  linkedProfile: null | {
    id: string;
    slug: string;
    companyName: string;
    organizationNumber: string;
    city: string;
  };
  pendingClaim: null | {
    status: string;
    companyName: string;
    organizationNumber: string;
    profileSlug: string;
  };
  directoryServices: ProviderActivationDirectoryService[];
  workspaceServices: Awaited<ReturnType<typeof getDashboardWorkspaceServices>>;
};

async function requireManageableWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("workspace_access");
  }
  return access;
}

export function ownerVisibleDirectoryOrganizationNumber(kind: unknown, value: unknown) {
  return String(kind ?? "") === "juridical_person" ? String(value ?? "") : "";
}

export function providerProfileCanOpenPublicPage(profile: {
  publication_status?: unknown;
  is_active?: unknown;
  privacy_blocked?: unknown;
  auto_public_eligible?: unknown;
  published_at?: unknown;
} | null | undefined) {
  if (!profile) return false;
  return String(profile.publication_status ?? "") === "claimed"
    && Boolean(profile.is_active)
    && !Boolean(profile.privacy_blocked)
    && Boolean(profile.auto_public_eligible)
    && Boolean(profile.published_at);
}

export function providerSoleTraderProfileCanReleaseMarketplace(
  profile: {
    organization_kind?: unknown;
    organization_number?: unknown;
    publication_status?: unknown;
    is_active?: unknown;
    privacy_blocked?: unknown;
    auto_public_eligible?: unknown;
    published_at?: unknown;
    official_source?: unknown;
    display_name?: unknown;
    legal_form?: unknown;
    organization_status?: unknown;
    address_line1?: unknown;
    postal_code?: unknown;
  } | null | undefined,
  claim: { status?: unknown; verification_method?: unknown } | null | undefined,
) {
  if (!profile || !claim) return false;
  return String(profile.organization_kind ?? "") === "sole_trader"
    && SOLE_TRADER_SURROGATE_IDENTITY.test(String(profile.organization_number ?? ""))
    && String(profile.publication_status ?? "") === "blocked"
    && Boolean(profile.is_active)
    && Boolean(profile.privacy_blocked)
    && !Boolean(profile.auto_public_eligible)
    && !Boolean(profile.published_at)
    && String(profile.official_source ?? "") === SOLE_TRADER_OWNER_SOURCE
    && String(profile.display_name ?? "").trim().length > 0
    && String(profile.legal_form ?? "").trim().length > 0
    && String(profile.organization_status ?? "") === "Registrerad"
    && String(profile.address_line1 ?? "").trim() === ""
    && String(profile.postal_code ?? "").trim() === ""
    && String(claim.status ?? "") === "claimed"
    && String(claim.verification_method ?? "") === "manual_review";
}

export function exactOwnerDirectoryServiceCandidate(value: unknown): ProviderActivationDirectoryService | null {
  const resolution = resolveDirectoryServiceQuery(String(value ?? ""));
  if (!resolution || resolution.kind !== "service") return null;
  const service = getDirectoryServiceDefinition(resolution.serviceSlug);
  return service ? { slug: service.slug, label: service.label } : null;
}

export async function getProviderActivationState(): Promise<ProviderActivationState> {
  const access = await requireManageableWorkspace();
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  // Materialize exact Directory classifications only as owner-visible drafts.
  // These rows stay outside public Search/Marketplace truth until the owner
  // explicitly publishes them through activateProviderMarketplaceService.
  await sql`
    insert into workspace_services (
      workspace_id,
      name,
      category,
      price_type,
      price_amount_minor,
      is_active,
      sort_order,
      public_slug,
      primary_directory_service_slug,
      public_status,
      conversion_mode
    )
    select
      ${access.workspaceId},
      service.label,
      service.label,
      'quote',
      null,
      true,
      100,
      service.slug,
      service.slug,
      'draft',
      'quote'
    from company_directory_profiles profile
    join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.is_active = true
     and relation.public_visible = true
    join company_directory_services service
      on service.slug = relation.service_slug
     and service.is_active = true
    where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and not exists (
        select 1
        from workspace_services existing
        where existing.workspace_id = ${access.workspaceId}
          and (
            coalesce(nullif(trim(existing.primary_directory_service_slug), ''), existing.public_slug) = service.slug
            or existing.public_slug = service.slug
            or lower(trim(existing.name)) = lower(trim(service.label))
          )
      )
    on conflict do nothing
  `;

  const [profileRows, claimRows, workspaceServices] = await Promise.all([
    sql`
      select
        profile.id::text,
        profile.public_slug,
        profile.display_name,
        profile.organization_number,
        profile.organization_kind,
        profile.legal_form,
        profile.organization_status,
        profile.address_line1,
        profile.postal_code,
        profile.city,
        profile.publication_status,
        profile.is_active,
        profile.privacy_blocked,
        profile.auto_public_eligible,
        profile.official_source,
        profile.published_at
      from company_directory_profiles profile
      where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      order by profile.updated_at desc
      limit 1
    `,
    sql`
      select
        claim.status,
        claim.verification_method,
        profile.display_name,
        profile.organization_number,
        profile.organization_kind,
        profile.public_slug,
        profile.publication_status
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      where claim.requested_workspace_id = ${access.workspaceId}::uuid
        and claim.status in ('pending', 'verified', 'claimed')
      order by claim.requested_at desc
      limit 1
    `,
    getDashboardWorkspaceServices(),
  ]);

  const profile = profileRows[0];
  const claim = claimRows[0];
  const profileCanOpenPublicPage = providerProfileCanOpenPublicPage(profile);
  const soleTraderCanRelease = providerSoleTraderProfileCanReleaseMarketplace(profile, claim);
  const profileCanOfferMarketplace = profileCanOpenPublicPage || soleTraderCanRelease;
  const linkedProfile = profile
    ? {
        id: String(profile.id),
        slug: profileCanOpenPublicPage ? String(profile.public_slug ?? "") : "",
        companyName: String(profile.display_name ?? ""),
        organizationNumber: ownerVisibleDirectoryOrganizationNumber(profile.organization_kind, profile.organization_number),
        city: String(profile.city ?? ""),
      }
    : null;

  const directoryRows = profileCanOfferMarketplace && linkedProfile
    ? await sql`
        select service.slug, service.label
        from company_directory_profile_services relation
        join company_directory_services service
          on service.slug = relation.service_slug
         and service.is_active = true
        where relation.profile_id = ${linkedProfile.id}::uuid
          and relation.is_active = true
          and relation.public_visible = true
        order by service.label asc, service.slug asc
      `
    : [];

  const directoryServiceMap = new Map<string, ProviderActivationDirectoryService>();
  for (const row of directoryRows) {
    const service = { slug: String(row.slug), label: String(row.label) };
    directoryServiceMap.set(service.slug, service);
  }
  if (profileCanOfferMarketplace && linkedProfile) {
    for (const workspaceService of workspaceServices) {
      if (!workspaceService.isActive) continue;
      const candidate = exactOwnerDirectoryServiceCandidate(workspaceService.name);
      if (candidate && !directoryServiceMap.has(candidate.slug)) {
        directoryServiceMap.set(candidate.slug, candidate);
      }
    }
  }

  const claimStatus = String(claim?.status ?? "");
  const soleTraderManualReview = String(claim?.organization_kind ?? "") === "sole_trader"
    && String(claim?.verification_method ?? "") === "manual_review";
  const pendingClaim = claim && (claimStatus === "pending" || claimStatus === "verified")
    ? {
        status: claimStatus,
        companyName: String(claim.display_name ?? ""),
        organizationNumber: ownerVisibleDirectoryOrganizationNumber(claim.organization_kind, claim.organization_number),
        profileSlug: soleTraderManualReview || String(claim.publication_status ?? "") === "blocked"
          ? ""
          : String(claim.public_slug ?? ""),
      }
    : null;

  return {
    workspaceId: access.workspaceId,
    workspaceName: access.workspaceName,
    linkedProfile,
    pendingClaim,
    directoryServices: [...directoryServiceMap.values()].sort((left, right) => left.label.localeCompare(right.label, "sv")),
    workspaceServices,
  };
}

export type ProviderProfileLookupResult =
  | { status: "available"; profileSlug: string; companyName: string }
  | { status: "linked"; profileSlug: string; companyName: string }
  | { status: "claimed"; companyName: string }
  | { status: "busy"; companyName: string }
  | { status: "not_ready" }
  | { status: "not_found" };

export async function findProviderProfileByOrganizationNumber(value: unknown): Promise<ProviderProfileLookupResult> {
  const access = await requireManageableWorkspace();
  const organizationNumber = normalizeSwedishOrganizationNumber(value);
  if (!organizationNumber) throw new Error("organization_number");
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  const rows = await sql`
    select
      profile.public_slug,
      profile.display_name,
      profile.publication_status,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text
    from company_directory_profiles profile
    where profile.country_code = 'SE'
      and profile.organization_number = ${organizationNumber}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { status: "not_found" };
  if (Boolean(row.privacy_blocked)) return { status: "not_ready" };

  const companyName = String(row.display_name ?? "");
  const profileSlug = String(row.public_slug ?? "");
  const claimedWorkspaceId = String(row.claimed_workspace_id ?? "");
  if (claimedWorkspaceId === access.workspaceId) {
    return profileSlug ? { status: "linked", profileSlug, companyName } : { status: "not_ready" };
  }
  if (claimedWorkspaceId) return { status: "claimed", companyName };
  if (row.claim_reservation_id) return { status: "busy", companyName };
  if (
    String(row.publication_status) !== "published"
    || !Boolean(row.is_active)
    || !Boolean(row.auto_public_eligible)
    || !profileSlug
  ) {
    return { status: "not_ready" };
  }

  return { status: "available", profileSlug, companyName };
}

export async function activateProviderMarketplaceService(input: {
  serviceId: string;
  directoryServiceSlug: string;
  conversionMode: ProviderMarketplaceConversionMode | string;
  radiusKm: unknown;
}) {
  const access = await requireManageableWorkspace();
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");
  if (!/^[0-9a-f-]{36}$/i.test(input.serviceId)) throw new Error("service");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.directoryServiceSlug)) throw new Error("directory_service");
  if (!isProviderMarketplaceConversionMode(input.conversionMode)) throw new Error("conversion_mode");
  const radiusKm = normalizeProviderServiceAreaRadius(input.radiusKm);
  if (radiusKm === null) throw new Error("radius");

  const rows = await sql`
    select
      service.id::text,
      service.name,
      nullif(trim(service.primary_directory_service_slug), '') as previous_directory_service_slug,
      profile.id::text as profile_id,
      (relation.profile_id is not null) as has_existing_relation,
      (profile.organization_kind = 'sole_trader' and profile.publication_status = 'blocked') as requires_privacy_release
    from workspace_services service
    join company_directory_profiles profile
      on profile.claimed_workspace_id = ${access.workspaceId}::uuid
     and profile.is_active = true
     and (
       (
         profile.publication_status = 'claimed'
         and profile.privacy_blocked = false
         and profile.auto_public_eligible = true
       )
       or (
         profile.organization_kind = 'sole_trader'
         and profile.organization_number ~ '^sole-trader-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         and profile.publication_status = 'blocked'
         and profile.privacy_blocked = true
         and profile.auto_public_eligible = false
         and profile.published_at is null
         and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
         and coalesce(trim(profile.display_name), '') <> ''
         and coalesce(trim(profile.legal_form), '') <> ''
         and profile.organization_status = 'Registrerad'
         and coalesce(trim(profile.address_line1), '') = ''
         and coalesce(trim(profile.postal_code), '') = ''
         and exists (
           select 1
           from company_directory_claims owner_claim
           where owner_claim.profile_id = profile.id
             and owner_claim.requested_workspace_id = ${access.workspaceId}::uuid
             and owner_claim.status = 'claimed'
             and owner_claim.verification_method = 'manual_review'
         )
       )
     )
    join company_directory_services directory_service
      on directory_service.slug = ${input.directoryServiceSlug}
     and directory_service.is_active = true
    left join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.service_slug = directory_service.slug
     and relation.is_active = true
     and relation.public_visible = true
    where service.id = ${input.serviceId}::uuid
      and service.workspace_id = ${access.workspaceId}
      and service.is_active = true
      and not exists (
        select 1
        from workspace_services duplicate
        where duplicate.workspace_id = service.workspace_id
          and duplicate.id <> service.id
          and coalesce(duplicate.primary_directory_service_slug, duplicate.public_slug) = ${input.directoryServiceSlug}
      )
    limit 1
  `;
  const service = rows[0];
  if (!service) throw new Error("service_not_eligible");

  const hasExistingRelation = Boolean(service.has_existing_relation);
  if (!hasExistingRelation) {
    const candidate = exactOwnerDirectoryServiceCandidate(service.name);
    if (!candidate || candidate.slug !== input.directoryServiceSlug) {
      throw new Error("service_not_eligible");
    }
  }

  const profileId = String(service.profile_id);
  const requiresPrivacyRelease = Boolean(service.requires_privacy_release);
  const previousDirectoryServiceSlug = service.previous_directory_service_slug
    ? String(service.previous_directory_service_slug)
    : null;

  const published = await sql`
    with service_guard as (
      select service.id
      from workspace_services service
      where service.id = ${input.serviceId}::uuid
        and service.workspace_id = ${access.workspaceId}
        and service.is_active = true
        and not exists (
          select 1
          from workspace_services duplicate
          where duplicate.workspace_id = service.workspace_id
            and duplicate.id <> service.id
            and coalesce(duplicate.primary_directory_service_slug, duplicate.public_slug) = ${input.directoryServiceSlug}
        )
      for update
    ),
    profile_guard as (
      select profile.id, ${requiresPrivacyRelease}::boolean as requires_privacy_release
      from company_directory_profiles profile
      where profile.id = ${profileId}::uuid
        and profile.claimed_workspace_id = ${access.workspaceId}::uuid
        and profile.is_active = true
        and (
          (
            ${requiresPrivacyRelease} = false
            and profile.publication_status = 'claimed'
            and profile.privacy_blocked = false
            and profile.auto_public_eligible = true
          )
          or (
            ${requiresPrivacyRelease} = true
            and profile.organization_kind = 'sole_trader'
            and profile.organization_number ~ '^sole-trader-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and profile.publication_status = 'blocked'
            and profile.privacy_blocked = true
            and profile.auto_public_eligible = false
            and profile.published_at is null
            and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
            and coalesce(trim(profile.display_name), '') <> ''
            and coalesce(trim(profile.legal_form), '') <> ''
            and profile.organization_status = 'Registrerad'
            and coalesce(trim(profile.address_line1), '') = ''
            and coalesce(trim(profile.postal_code), '') = ''
            and exists (
              select 1
              from company_directory_claims owner_claim
              where owner_claim.profile_id = profile.id
                and owner_claim.requested_workspace_id = ${access.workspaceId}::uuid
                and owner_claim.status = 'claimed'
                and owner_claim.verification_method = 'manual_review'
            )
          )
        )
      for update
    ),
    confirmed_area as (
      insert into company_directory_service_areas (
        profile_id, service_slug, radius_km, source_type, confidence, public_visible, confirmed_at, updated_at
      )
      select profile.id, ${input.directoryServiceSlug}, ${radiusKm}, 'owner', 100, true, now(), now()
      from service_guard
      join profile_guard profile on true
      on conflict (profile_id, service_slug) where service_slug is not null
      do update set
        radius_km = excluded.radius_km,
        confidence = 100,
        public_visible = true,
        confirmed_at = now(),
        updated_at = now()
      where company_directory_service_areas.source_type = 'owner'
      returning profile_id
    ),
    owner_relation as (
      insert into company_directory_profile_services (
        profile_id,
        service_slug,
        source_type,
        confidence,
        is_primary,
        is_active,
        public_visible,
        confirmed_at,
        updated_at
      )
      select
        ${profileId}::uuid,
        ${input.directoryServiceSlug},
        'owner',
        100,
        false,
        true,
        true,
        now(),
        now()
      from service_guard
      where ${hasExistingRelation} = false
        and exists (select 1 from confirmed_area)
      on conflict (profile_id, service_slug)
      do update set
        confidence = 100,
        is_active = true,
        public_visible = true,
        confirmed_at = now(),
        updated_at = now()
      where company_directory_profile_services.source_type = 'owner'
      returning profile_id
    ),
    relation_guard as (
      select profile_id
      from owner_relation
      union all
      select relation.profile_id
      from company_directory_profile_services relation
      join company_directory_services directory_service
        on directory_service.slug = relation.service_slug
       and directory_service.is_active = true
      where relation.profile_id = ${profileId}::uuid
        and relation.service_slug = ${input.directoryServiceSlug}
        and relation.is_active = true
        and relation.public_visible = true
      limit 1
    ),
    released_profile as (
      update company_directory_profiles profile
      set publication_status = 'claimed',
          privacy_blocked = false,
          auto_public_eligible = true,
          published_at = coalesce(profile.published_at, now()),
          quality_reasons = (coalesce(profile.quality_reasons, '[]'::jsonb) - 'sole_trader_owner_verification_pending')
            || '["sole_trader_owner_verified_business_safe"]'::jsonb,
          updated_at = now()
      from profile_guard guard
      where profile.id = guard.id
        and guard.requires_privacy_release = true
        and exists (select 1 from confirmed_area)
        and exists (select 1 from relation_guard)
      returning profile.id
    ),
    publication_profile as (
      select id
      from profile_guard
      where requires_privacy_release = false
      union all
      select id
      from released_profile
    ),
    published_service as (
      update workspace_services service
      set primary_directory_service_slug = ${input.directoryServiceSlug},
          public_status = 'published',
          conversion_mode = ${input.conversionMode},
          updated_at = now()
      where service.id = ${input.serviceId}::uuid
        and service.workspace_id = ${access.workspaceId}
        and service.is_active = true
        and exists (select 1 from service_guard)
        and exists (select 1 from confirmed_area)
        and exists (select 1 from relation_guard)
        and exists (select 1 from publication_profile)
      returning service.id
    ),
    removed_area as (
      delete from company_directory_service_areas area
      where exists (select 1 from published_service)
        and area.profile_id = ${profileId}::uuid
        and area.service_slug = ${previousDirectoryServiceSlug}
        and ${previousDirectoryServiceSlug}::text is not null
        and ${previousDirectoryServiceSlug}::text <> ${input.directoryServiceSlug}
        and area.source_type = 'owner'
      returning area.profile_id
    )
    select service.id::text
    from published_service service
    join confirmed_area area on true
  `;

  if (!published[0]?.id) throw new Error("service_update");
  return { serviceId: input.serviceId, directoryServiceSlug: input.directoryServiceSlug, conversionMode: input.conversionMode, radiusKm };
}