import "server-only";

import {
  projectBusinessProfileSearchCard,
  resolveBusinessProfilePolicy,
  type BusinessProfileDirectoryServiceSource,
  type BusinessProfileOwnerServiceSource,
  type BusinessProfileReputationSource,
  type SearchCardBusinessProjection,
} from "@/lib/business-profile-policy";
import {
  searchPublishedCompanyDirectory,
  type PublishedDirectorySearchInput,
  type PublishedDirectorySearchResponse,
  type PublishedDirectorySearchResult,
} from "@/lib/company-directory-public-search";
import { getSql } from "@/lib/db/server";
import { getWorkspaceDirectoryPublicAccessForWorkspaces } from "@/lib/workspace-feature-entitlement-db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BusinessProfileSearchResult = PublishedDirectorySearchResult & {
  profile: SearchCardBusinessProjection;
};

export type BusinessProfileSearchResponse = Omit<PublishedDirectorySearchResponse, "results"> & {
  results: BusinessProfileSearchResult[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeProfileId(value: unknown) {
  return text(value).toLowerCase();
}

function nullableUuid(value: unknown) {
  const normalized = normalizeProfileId(value);
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fallbackSearchCard(result: PublishedDirectorySearchResult): SearchCardBusinessProjection {
  return {
    profileId: result.id,
    directorySlug: result.slug,
    workspaceSlug: result.claimedWorkspaceSlug,
    displayName: result.companyName,
    categorySlug: result.categorySlug,
    city: result.city,
    municipality: result.municipality,
    media: null,
    canonicalServiceSlugs: [],
    reputation: null,
    capabilities: {
      richWebsite: Boolean(result.claimedWorkspaceSlug),
      onlineBooking: result.bookingAvailable,
      mediatedQuote: true,
    },
  };
}

export function applyBusinessProfileSearchCard(
  result: PublishedDirectorySearchResult,
  profile: SearchCardBusinessProjection,
): BusinessProfileSearchResult {
  const marketplaceAvailable = Boolean(
    profile.capabilities.richWebsite
    && profile.workspaceSlug
    && result.claimedServiceId
    && result.claimedServiceSlug
    && result.conversionMode,
  );
  const bookingAvailable = Boolean(
    marketplaceAvailable
    && profile.capabilities.onlineBooking
    && result.bookingAvailable,
  );

  return {
    ...result,
    companyName: profile.displayName,
    categorySlug: profile.categorySlug || result.categorySlug,
    city: profile.city,
    municipality: profile.municipality,
    claimedWorkspaceSlug: marketplaceAvailable ? profile.workspaceSlug : null,
    claimedServiceId: marketplaceAvailable ? result.claimedServiceId : null,
    claimedServiceSlug: marketplaceAvailable ? result.claimedServiceSlug : null,
    claimedBookingSlug: marketplaceAvailable ? result.claimedBookingSlug : null,
    conversionMode: marketplaceAvailable ? result.conversionMode : null,
    bookingAvailable,
    profile,
  };
}

type ContextRow = {
  profile_id?: unknown;
  claimed_workspace_id?: unknown;
  legal_name?: unknown;
  legal_form?: unknown;
  organization_status?: unknown;
  organization_number?: unknown;
  primary_sni_code?: unknown;
  primary_sni_label?: unknown;
  owner_workspace_id?: unknown;
  workspace_slug?: unknown;
  public_booking_slug?: unknown;
  company_name?: unknown;
  business_intro?: unknown;
  logo_url?: unknown;
  hero_image_url?: unknown;
  featured_media_url?: unknown;
  directory_media_url?: unknown;
  directory_media_kind?: unknown;
  directory_media_attribution?: unknown;
  directory_media_actual?: unknown;
};

function groupOwnerServices(rows: Array<Record<string, unknown>>) {
  const grouped = new Map<string, BusinessProfileOwnerServiceSource[]>();
  for (const row of rows) {
    const profileId = normalizeProfileId(row.profile_id);
    if (!UUID_PATTERN.test(profileId)) continue;
    const current = grouped.get(profileId) ?? [];
    current.push({
      id: text(row.id),
      name: text(row.name),
      description: text(row.description),
      publicSlug: text(row.public_slug),
      canonicalServiceSlug: text(row.primary_directory_service_slug),
      conversionMode: text(row.conversion_mode),
    });
    grouped.set(profileId, current);
  }
  return grouped;
}

function groupDirectoryServices(rows: Array<Record<string, unknown>>) {
  const grouped = new Map<string, BusinessProfileDirectoryServiceSource[]>();
  for (const row of rows) {
    const profileId = normalizeProfileId(row.profile_id);
    if (!UUID_PATTERN.test(profileId)) continue;
    const current = grouped.get(profileId) ?? [];
    current.push({
      slug: text(row.slug),
      label: text(row.label),
      confirmed: Boolean(row.confirmed_at),
    });
    grouped.set(profileId, current);
  }
  return grouped;
}

function mapReputation(rows: Array<Record<string, unknown>>) {
  const mapped = new Map<string, BusinessProfileReputationSource>();
  for (const row of rows) {
    const profileId = normalizeProfileId(row.profile_id);
    if (!UUID_PATTERN.test(profileId)) continue;
    mapped.set(profileId, {
      rating: number(row.rating),
      verifiedReviews: number(row.verified_review_count),
      completedJobs: number(row.completed_jobs),
      customerCancellations: number(row.customer_cancelled_jobs),
      providerCancellations: number(row.provider_cancelled_jobs),
      noShows: number(row.no_show_jobs),
      problemJobs: number(row.problem_jobs),
    });
  }
  return mapped;
}

async function hydrateSearchCards(
  results: PublishedDirectorySearchResult[],
): Promise<Map<string, SearchCardBusinessProjection>> {
  const normalizedResults = results.map((result) => ({
    result,
    profileId: normalizeProfileId(result.id),
  }));
  const fallback = new Map(normalizedResults.map(({ result }) => [result.id, fallbackSearchCard(result)]));
  const profileIds = [...new Set(
    normalizedResults
      .map(({ profileId }) => profileId)
      .filter((profileId) => UUID_PATTERN.test(profileId)),
  )];
  const sql = getSql();
  if (!sql || profileIds.length === 0) return fallback;

  const profileIdCsv = profileIds.join(",");

  try {
    const [contextRows, ownerServiceRows, directoryServiceRows, reputationRows] = await Promise.all([
      sql`
        with requested as (
          select unnest(string_to_array(${profileIdCsv}, ',')::uuid[]) as profile_id
        )
        select
          profile.id::text as profile_id,
          profile.claimed_workspace_id::text as claimed_workspace_id,
          profile.legal_name,
          profile.legal_form,
          profile.organization_status,
          profile.organization_number,
          profile.primary_sni_code,
          profile.primary_sni_label,
          workspace.id::text as owner_workspace_id,
          coalesce(workspace.slug, '') as workspace_slug,
          coalesce(workspace.public_booking_slug, '') as public_booking_slug,
          coalesce(nullif(settings.company_name, ''), workspace.company_name, workspace.name, '') as company_name,
          coalesce(experience.business_intro, '') as business_intro,
          coalesce(experience.logo_url, '') as logo_url,
          coalesce(experience.hero_image_url, '') as hero_image_url,
          coalesce(featured_media.public_url, '') as featured_media_url,
          coalesce(directory_media.public_url, '') as directory_media_url,
          coalesce(directory_media.media_kind, '') as directory_media_kind,
          coalesce(directory_media.attribution, '') as directory_media_attribution,
          coalesce(directory_media.is_actual_business_media, false) as directory_media_actual
        from requested
        join company_directory_profiles profile on profile.id = requested.profile_id
        left join workspaces workspace
          on workspace.id = profile.claimed_workspace_id
         and workspace.status in ('active', 'trial')
        left join workspace_settings settings on settings.workspace_id = workspace.id::text
        left join workspace_experience_settings experience on experience.workspace_id = workspace.id
        left join lateral (
          select gallery.public_url
          from website_gallery_items gallery
          where gallery.workspace_id = workspace.id
            and gallery.status = 'published'
            and gallery.media_type = 'image'
            and nullif(trim(gallery.public_url), '') is not null
          order by gallery.is_featured desc, gallery.sort_order asc, gallery.created_at desc
          limit 1
        ) featured_media on true
        left join lateral (
          select media.public_url, media.media_kind, media.attribution, media.is_actual_business_media
          from company_directory_media media
          where media.profile_id = profile.id
            and media.publication_status = 'published'
          order by media.is_primary desc, media.is_actual_business_media desc, media.created_at desc
          limit 1
        ) directory_media on true
        where profile.is_active = true
          and profile.privacy_blocked = false
      `,
      sql`
        with requested as (
          select unnest(string_to_array(${profileIdCsv}, ',')::uuid[]) as profile_id
        )
        select
          profile.id::text as profile_id,
          service.id::text,
          service.name,
          service.description,
          coalesce(service.public_slug, '') as public_slug,
          coalesce(service.primary_directory_service_slug, '') as primary_directory_service_slug,
          service.conversion_mode
        from requested
        join company_directory_profiles profile on profile.id = requested.profile_id
        join workspace_services service
          on service.workspace_id = profile.claimed_workspace_id::text
         and service.is_active = true
         and service.public_status = 'published'
        order by profile.id, service.sort_order asc, service.name asc, service.id asc
      `,
      sql`
        with requested as (
          select unnest(string_to_array(${profileIdCsv}, ',')::uuid[]) as profile_id
        )
        select
          relation.profile_id::text as profile_id,
          service.slug,
          service.label,
          relation.confirmed_at
        from requested
        join company_directory_profile_services relation
          on relation.profile_id = requested.profile_id
         and relation.is_active = true
         and relation.public_visible = true
        join company_directory_services service
          on service.slug = relation.service_slug
         and service.is_active = true
        order by relation.profile_id, relation.is_primary desc, service.sort_order asc, service.slug asc
      `,
      sql`
        with requested as (
          select unnest(string_to_array(${profileIdCsv}, ',')::uuid[]) as profile_id
        )
        select
          reputation.profile_id::text as profile_id,
          reputation.rating,
          reputation.verified_review_count,
          reputation.completed_jobs,
          reputation.customer_cancelled_jobs,
          reputation.provider_cancelled_jobs,
          reputation.no_show_jobs,
          reputation.problem_jobs
        from requested
        join marketplace_profile_reputation reputation on reputation.profile_id = requested.profile_id
      `.catch((error: unknown) => {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "42P01" || code === "42703") return [];
        throw error;
      }),
    ]);

    const contextByProfileId = new Map<string, ContextRow>();
    const claimedWorkspaceIds: string[] = [];
    for (const row of contextRows as ContextRow[]) {
      const profileId = normalizeProfileId(row.profile_id);
      if (!UUID_PATTERN.test(profileId)) continue;
      contextByProfileId.set(profileId, row);
      const claimedWorkspaceId = nullableUuid(row.claimed_workspace_id);
      const ownerWorkspaceId = nullableUuid(row.owner_workspace_id);
      if (claimedWorkspaceId && ownerWorkspaceId === claimedWorkspaceId) claimedWorkspaceIds.push(claimedWorkspaceId);
    }

    const [ownerServices, directoryServices, reputationByProfileId, accessByWorkspace] = await Promise.all([
      groupOwnerServices(ownerServiceRows as Array<Record<string, unknown>>),
      groupDirectoryServices(directoryServiceRows as Array<Record<string, unknown>>),
      mapReputation(reputationRows as Array<Record<string, unknown>>),
      getWorkspaceDirectoryPublicAccessForWorkspaces(claimedWorkspaceIds),
    ]);

    const cards = new Map<string, SearchCardBusinessProjection>();
    for (const { result, profileId } of normalizedResults) {
      const context = contextByProfileId.get(profileId);
      if (!context) {
        cards.set(result.id, fallbackSearchCard(result));
        continue;
      }

      const claimedWorkspaceId = nullableUuid(context.claimed_workspace_id);
      const ownerWorkspaceId = nullableUuid(context.owner_workspace_id);
      const ownerBound = Boolean(claimedWorkspaceId && ownerWorkspaceId === claimedWorkspaceId);
      const access = claimedWorkspaceId ? accessByWorkspace.get(claimedWorkspaceId) : null;
      const directoryMediaUrl = text(context.directory_media_url);

      const resolved = resolveBusinessProfilePolicy({
        official: {
          profileId: result.id,
          directorySlug: result.slug,
          claimedWorkspaceId,
          legalName: text(context.legal_name) || result.companyName,
          displayName: result.companyName,
          legalForm: text(context.legal_form),
          organizationStatus: text(context.organization_status),
          organizationNumber: text(context.organization_number),
          categorySlug: result.categorySlug,
          primarySniCode: text(context.primary_sni_code),
          primarySniLabel: text(context.primary_sni_label),
          activityDescription: result.activityDescription,
          publicLocation: {
            addressLine1: "",
            postalCode: result.postalCode,
            city: result.city,
            municipality: result.municipality,
          },
          media: directoryMediaUrl
            ? {
                url: directoryMediaUrl,
                kind: text(context.directory_media_kind),
                attribution: text(context.directory_media_attribution),
                isActualBusinessMedia: Boolean(context.directory_media_actual),
              }
            : null,
        },
        owner: ownerBound && ownerWorkspaceId
          ? {
              workspaceId: ownerWorkspaceId,
              workspaceSlug: text(context.workspace_slug),
              bookingSlug: text(context.public_booking_slug),
              companyName: text(context.company_name),
              businessIntro: text(context.business_intro),
              logoUrl: text(context.logo_url),
              heroImageUrl: text(context.hero_image_url),
              featuredMediaUrl: text(context.featured_media_url),
              services: ownerServices.get(profileId) ?? [],
            }
          : null,
        directoryServices: directoryServices.get(profileId) ?? [],
        serviceAreas: [],
        reputation: reputationByProfileId.get(profileId) ?? null,
        publicContact: null,
        entitlements: claimedWorkspaceId
          ? {
              workspaceId: claimedWorkspaceId,
              directContact: false,
              richWebsite: Boolean(access?.websiteBuilder),
              onlineBooking: Boolean(access?.onlineBooking),
            }
          : null,
      });

      cards.set(result.id, projectBusinessProfileSearchCard(resolved));
    }

    return cards;
  } catch (error) {
    console.error("Failed to hydrate BusinessProfile Search cards", error);
    return fallback;
  }
}

export async function hydratePublishedDirectorySearchWithBusinessProfiles(
  search: PublishedDirectorySearchResponse,
): Promise<BusinessProfileSearchResponse> {
  if (search.results.length === 0) return { ...search, results: [] };
  const cards = await hydrateSearchCards(search.results);
  return {
    ...search,
    results: search.results.map((result) => applyBusinessProfileSearchCard(
      result,
      cards.get(result.id) ?? fallbackSearchCard(result),
    )),
  };
}

export async function searchPublishedBusinessProfiles(
  input: PublishedDirectorySearchInput = {},
): Promise<BusinessProfileSearchResponse> {
  const search = await searchPublishedCompanyDirectory(input);
  return hydratePublishedDirectorySearchWithBusinessProfiles(search);
}
