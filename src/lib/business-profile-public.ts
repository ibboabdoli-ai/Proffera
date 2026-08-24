import "server-only";

import { cache } from "react";

import {
  projectBusinessProfilePublicProfile,
  projectBusinessProfileSeo,
  resolveBusinessProfilePolicy,
  type BusinessProfileEntitlements,
  type BusinessProfileOwnerSource,
  type BusinessProfileOwnerServiceSource,
  type PublicProfileBusinessProjection,
  type ResolvedBusinessProfile,
  type SeoBusinessProjection,
} from "@/lib/business-profile-policy";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { getPublicDirectoryProfileExtras } from "@/lib/company-directory-public-profile-extras";
import { getSql } from "@/lib/db/server";
import { getWorkspaceDirectoryPublicAccessForWorkspaces } from "@/lib/workspace-feature-entitlement-db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicDirectoryBusiness = NonNullable<Awaited<ReturnType<typeof getPublicDirectoryBusinessForRequest>>>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableUuid(value: unknown) {
  const normalized = text(value).toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

async function getProfileOwnerContext(profileId: string) {
  const sql = getSql();
  if (!sql || !UUID_PATTERN.test(profileId)) {
    return {
      legalName: "",
      claimedWorkspaceId: null as string | null,
      owner: null as BusinessProfileOwnerSource | null,
    };
  }

  try {
    const rows = await sql`
      select
        profile.legal_name,
        profile.claimed_workspace_id::text as claimed_workspace_id,
        workspace.id::text as owner_workspace_id,
        coalesce(workspace.slug, '') as workspace_slug,
        coalesce(workspace.public_booking_slug, '') as public_booking_slug,
        coalesce(nullif(settings.company_name, ''), workspace.company_name, workspace.name, '') as company_name,
        coalesce(experience.business_intro, '') as business_intro,
        coalesce(experience.logo_url, '') as logo_url,
        coalesce(experience.hero_image_url, '') as hero_image_url,
        coalesce(featured_media.public_url, '') as featured_media_url
      from company_directory_profiles profile
      left join workspaces workspace
        on workspace.id = profile.claimed_workspace_id
       and workspace.status in ('active', 'trial')
      left join workspace_settings settings
        on settings.workspace_id = workspace.id::text
      left join workspace_experience_settings experience
        on experience.workspace_id = workspace.id
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
      where profile.id = ${profileId}::uuid
        and profile.is_active = true
        and profile.privacy_blocked = false
      limit 1
    `;
    const row = rows[0];
    const claimedWorkspaceId = nullableUuid(row?.claimed_workspace_id);
    const ownerWorkspaceId = nullableUuid(row?.owner_workspace_id);
    if (!row || !claimedWorkspaceId || !ownerWorkspaceId || claimedWorkspaceId !== ownerWorkspaceId) {
      return {
        legalName: text(row?.legal_name),
        claimedWorkspaceId,
        owner: null as BusinessProfileOwnerSource | null,
      };
    }

    const serviceRows = await sql`
      select
        service.id::text,
        service.name,
        service.description,
        coalesce(service.public_slug, '') as public_slug,
        coalesce(service.primary_directory_service_slug, '') as primary_directory_service_slug,
        service.conversion_mode
      from workspace_services service
      where service.workspace_id = ${ownerWorkspaceId}
        and service.is_active = true
        and service.public_status = 'published'
      order by service.sort_order asc, service.name asc, service.id asc
    `;

    const services: BusinessProfileOwnerServiceSource[] = serviceRows.map((service) => ({
      id: text(service.id),
      name: text(service.name),
      description: text(service.description),
      publicSlug: text(service.public_slug),
      canonicalServiceSlug: text(service.primary_directory_service_slug),
      conversionMode: text(service.conversion_mode),
    }));

    return {
      legalName: text(row.legal_name),
      claimedWorkspaceId,
      owner: {
        workspaceId: ownerWorkspaceId,
        workspaceSlug: text(row.workspace_slug),
        bookingSlug: text(row.public_booking_slug),
        companyName: text(row.company_name),
        businessIntro: text(row.business_intro),
        logoUrl: text(row.logo_url),
        heroImageUrl: text(row.hero_image_url),
        featuredMediaUrl: text(row.featured_media_url),
        services,
      },
    };
  } catch (error) {
    console.error("Failed to hydrate BusinessProfile owner context", error);
    return {
      legalName: "",
      claimedWorkspaceId: null as string | null,
      owner: null as BusinessProfileOwnerSource | null,
    };
  }
}

async function getProfileEntitlements(
  claimedWorkspaceId: string | null,
  directContact: boolean,
): Promise<BusinessProfileEntitlements | null> {
  if (!claimedWorkspaceId) return null;
  const access = await getWorkspaceDirectoryPublicAccessForWorkspaces([claimedWorkspaceId]);
  const workspaceAccess = access.get(claimedWorkspaceId);
  return {
    workspaceId: claimedWorkspaceId,
    directContact,
    richWebsite: Boolean(workspaceAccess?.websiteBuilder),
    onlineBooking: Boolean(workspaceAccess?.onlineBooking),
  };
}

async function resolvePublicBusinessProfile(
  business: PublicDirectoryBusiness,
): Promise<ResolvedBusinessProfile> {
  const [extras, ownerContext] = await Promise.all([
    getPublicDirectoryProfileExtras(business.id),
    getProfileOwnerContext(business.id),
  ]);
  const entitlements = await getProfileEntitlements(
    ownerContext.claimedWorkspaceId,
    business.contact.entitled,
  );

  return resolveBusinessProfilePolicy({
    official: {
      profileId: business.id,
      directorySlug: business.slug,
      claimedWorkspaceId: ownerContext.claimedWorkspaceId,
      legalName: ownerContext.legalName || business.companyName,
      displayName: business.companyName,
      legalForm: business.legalForm,
      organizationStatus: business.organizationStatus,
      organizationNumber: business.organizationNumber,
      categorySlug: business.categorySlug,
      primarySniCode: business.primarySniCode,
      primarySniLabel: business.primarySniLabel,
      activityDescription: business.activityDescription,
      publicLocation: {
        addressLine1: business.addressLine1,
        postalCode: business.postalCode,
        city: business.city,
        municipality: business.municipality,
      },
      media: business.media
        ? {
            url: business.media.url,
            kind: business.media.kind,
            attribution: business.media.attribution,
            isActualBusinessMedia: business.media.isActualBusinessMedia,
          }
        : null,
    },
    owner: ownerContext.owner,
    directoryServices: extras.services.map((service) => ({
      slug: service.slug,
      label: service.label,
      confirmed: service.confirmed,
    })),
    serviceAreas: extras.serviceAreas.map((area) => ({ ...area })),
    reputation: extras.reputation ? { ...extras.reputation } : null,
    publicContact: {
      entitled: business.contact.entitled,
      addressLine1: business.contact.addressLine1,
      phone: business.contact.phone,
      email: business.contact.email,
      website: business.contact.website,
      available: { ...business.contact.available },
    },
    entitlements,
  });
}

/**
 * Resolve one public business identity from the Directory profile first, then
 * overlay only the Workspace that is actually linked through
 * company_directory_profiles.claimed_workspace_id. The function never accepts
 * a caller-supplied Workspace id.
 *
 * This is the single-profile BusinessProfilePolicy path. Bulk Search hydration
 * intentionally remains separate so Search can stay bounded and avoid N+1
 * owner/entitlement lookups.
 */
export const getResolvedPublicBusinessProfile = cache(async (
  directorySlug: string,
): Promise<ResolvedBusinessProfile | null> => {
  const business = await getPublicDirectoryBusinessForRequest(directorySlug);
  return business ? resolvePublicBusinessProfile(business) : null;
});

/**
 * Compatibility view for the existing Directory profile UI. The public page
 * keeps its established layout/source timestamps while all user-visible
 * presentation, contact, exact services, service areas and reputation are
 * supplied by the central BusinessProfile policy.
 */
export async function getPublicBusinessProfileViewForRequest(directorySlug: string) {
  const business = await getPublicDirectoryBusinessForRequest(directorySlug);
  if (!business) return null;

  const profile = await resolvePublicBusinessProfile(business);
  const services = profile.services
    .map((service) => ({
      slug: service.canonicalServiceSlug || service.publicSlug || "",
      label: service.name,
      sourceType: service.source === "owner" ? "owner" : "proffera",
      confidence: 1,
      confirmed: true,
    }))
    .filter((service) => Boolean(service.slug));

  return {
    profile,
    business: {
      ...business,
      companyName: profile.presentation.displayName.value,
      categorySlug: profile.presentation.categorySlug,
      primarySniCode: profile.legal.primarySniCode,
      primarySniLabel: profile.legal.primarySniLabel,
      activityDescription: profile.presentation.description.value,
      addressLine1: profile.location.addressLine1,
      postalCode: profile.location.postalCode,
      city: profile.location.city,
      municipality: profile.location.municipality,
      legalForm: profile.legal.legalForm,
      organizationStatus: profile.legal.organizationStatus,
      organizationNumber: profile.legal.organizationNumber,
      contact: {
        ...profile.contact,
        available: { ...profile.contact.available },
      },
      media: profile.presentation.media
        ? {
            url: profile.presentation.media.url,
            kind: profile.presentation.media.kind,
            attribution: profile.presentation.media.attribution,
            isActualBusinessMedia: profile.presentation.media.role !== "illustration",
          }
        : null,
    },
    extras: {
      services,
      serviceAreas: profile.serviceAreas.map((area) => ({ ...area })),
      reputation: profile.reputation ? { ...profile.reputation } : null,
    },
  };
}

export async function getPublicProfileBusinessProjection(
  directorySlug: string,
): Promise<PublicProfileBusinessProjection | null> {
  const profile = await getResolvedPublicBusinessProfile(directorySlug);
  return profile ? projectBusinessProfilePublicProfile(profile) : null;
}

export async function getSeoBusinessProjection(
  directorySlug: string,
): Promise<SeoBusinessProjection | null> {
  const profile = await getResolvedPublicBusinessProfile(directorySlug);
  return profile ? projectBusinessProfileSeo(profile) : null;
}
