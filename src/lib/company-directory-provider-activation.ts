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

export async function getProviderActivationState(): Promise<ProviderActivationState> {
  const access = await requireManageableWorkspace();
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  const [profileRows, claimRows, workspaceServices] = await Promise.all([
    sql`
      select
        profile.id::text,
        profile.public_slug,
        profile.display_name,
        profile.organization_number,
        profile.city
      from company_directory_profiles profile
      where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      order by profile.updated_at desc
      limit 1
    `,
    sql`
      select
        claim.status,
        profile.display_name,
        profile.organization_number,
        profile.public_slug
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      where claim.requested_workspace_id = ${access.workspaceId}::uuid
        and claim.status in ('pending', 'verified')
      order by claim.requested_at desc
      limit 1
    `,
    getDashboardWorkspaceServices(),
  ]);

  const profile = profileRows[0];
  const linkedProfile = profile
    ? {
        id: String(profile.id),
        slug: String(profile.public_slug ?? ""),
        companyName: String(profile.display_name ?? ""),
        organizationNumber: String(profile.organization_number ?? ""),
        city: String(profile.city ?? ""),
      }
    : null;

  const directoryRows = linkedProfile
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

  const claim = claimRows[0];
  const pendingClaim = claim
    ? {
        status: String(claim.status),
        companyName: String(claim.display_name ?? ""),
        organizationNumber: String(claim.organization_number ?? ""),
        profileSlug: String(claim.public_slug ?? ""),
      }
    : null;

  return {
    workspaceId: access.workspaceId,
    workspaceName: access.workspaceName,
    linkedProfile,
    pendingClaim,
    directoryServices: directoryRows.map((row) => ({ slug: String(row.slug), label: String(row.label) })),
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
      nullif(trim(service.public_slug), '') as previous_public_slug,
      profile.id::text as profile_id
    from workspace_services service
    join company_directory_profiles profile
      on profile.claimed_workspace_id = ${access.workspaceId}::uuid
     and profile.publication_status = 'claimed'
     and profile.is_active = true
     and profile.privacy_blocked = false
     and profile.auto_public_eligible = true
    join company_directory_profile_services relation
      on relation.profile_id = profile.id
     and relation.service_slug = ${input.directoryServiceSlug}
     and relation.is_active = true
     and relation.public_visible = true
    join company_directory_services directory_service
      on directory_service.slug = relation.service_slug
     and directory_service.is_active = true
    where service.id = ${input.serviceId}::uuid
      and service.workspace_id = ${access.workspaceId}
      and service.is_active = true
      and not exists (
        select 1
        from workspace_services duplicate
        where duplicate.workspace_id = service.workspace_id
          and duplicate.id <> service.id
          and duplicate.public_slug = ${input.directoryServiceSlug}
      )
    limit 1
  `;
  const service = rows[0];
  if (!service) throw new Error("service_not_eligible");

  const profileId = String(service.profile_id);
  const previousPublicSlug = service.previous_public_slug ? String(service.previous_public_slug) : null;

  const published = await sql`
    with area_guard as (
      select 1 as allowed
      where not exists (
        select 1
        from company_directory_service_areas area
        where area.profile_id = ${profileId}::uuid
          and area.service_slug = ${input.directoryServiceSlug}
          and area.source_type <> 'owner'
      )
    ),
    published_service as (
      update workspace_services service
      set public_slug = ${input.directoryServiceSlug},
          public_status = 'published',
          conversion_mode = ${input.conversionMode},
          updated_at = now()
      where service.id = ${input.serviceId}::uuid
        and service.workspace_id = ${access.workspaceId}
        and service.is_active = true
        and exists (select 1 from area_guard)
      returning service.id
    ),
    removed_area as (
      delete from company_directory_service_areas area
      where exists (select 1 from published_service)
        and area.profile_id = ${profileId}::uuid
        and area.service_slug = ${previousPublicSlug}
        and ${previousPublicSlug}::text is not null
        and ${previousPublicSlug}::text <> ${input.directoryServiceSlug}
        and area.source_type = 'owner'
      returning area.profile_id
    ),
    confirmed_area as (
      insert into company_directory_service_areas (
        profile_id, service_slug, radius_km, source_type, confidence, public_visible, confirmed_at, updated_at
      )
      select ${profileId}::uuid, ${input.directoryServiceSlug}, ${radiusKm}, 'owner', 100, true, now(), now()
      from published_service
      on conflict (profile_id, service_slug) where service_slug is not null
      do update set
        radius_km = excluded.radius_km,
        confidence = 100,
        public_visible = true,
        confirmed_at = now(),
        updated_at = now()
      where company_directory_service_areas.source_type = 'owner'
      returning profile_id
    )
    select service.id::text
    from published_service service
    join confirmed_area area on true
  `;

  if (!published[0]?.id) throw new Error("service_update");
  return { serviceId: input.serviceId, directoryServiceSlug: input.directoryServiceSlug, conversionMode: input.conversionMode, radiusKm };
}
