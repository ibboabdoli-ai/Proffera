import { cache } from "react";

import {
  discloseDirectoryDirectContact,
  type DirectoryDirectContactDisclosure,
} from "@/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusiness, type PublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { hasActivePaidDirectoryContactAccess } from "@/lib/company-directory-paid-contact-entitlement";
import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  type DirectoryPublicAddress,
} from "@/lib/company-directory-scb-address";
import { getSql } from "@/lib/db/server";

export type PublicDirectoryBusinessForRequest = PublicDirectoryBusiness & {
  publicationStatus: "published" | "claimed";
  organizationNumber: string;
  primarySniCode: string;
  contact: DirectoryDirectContactDisclosure;
};

type ScbDirectContact = {
  phone: string;
  email: string;
  workplaces: unknown;
};

const EMPTY_PHYSICAL_ADDRESS: DirectoryPublicAddress = {
  addressLine1: "",
  postalCode: "",
  city: "",
  municipality: "",
};

function emptyContact() {
  return discloseDirectoryDirectContact({}, false);
}

function isMissingScbEnrichmentTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "42P01"
    && String(candidate.message ?? "").includes("company_directory_scb_enrichment");
}

function profileAddress(row: {
  addressLine1?: unknown;
  address_line1?: unknown;
  postalCode?: unknown;
  postal_code?: unknown;
  city?: unknown;
  municipality?: unknown;
}): DirectoryPublicAddress {
  return {
    addressLine1: String(row.addressLine1 ?? row.address_line1 ?? ""),
    postalCode: String(row.postalCode ?? row.postal_code ?? ""),
    city: String(row.city ?? ""),
    municipality: String(row.municipality ?? ""),
  };
}

function canonicalPublishedPhysicalAddress(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): DirectoryPublicAddress {
  const resolution = resolveCompanyDirectoryCanonicalWorkplaceAddress(profile, workplaces);
  return resolution.status === "resolved" ? resolution.address : EMPTY_PHYSICAL_ADDRESS;
}

async function getConflictFreeScbContact(
  sql: NonNullable<ReturnType<typeof getSql>>,
  profileId: string,
): Promise<ScbDirectContact | null> {
  try {
    const rows = await sql`
      select
        coalesce(nullif(phone, ''), '') as phone,
        coalesce(nullif(email, ''), '') as email,
        workplaces
      from company_directory_scb_enrichment
      where profile_id = ${profileId}::uuid
        and conflicts = '[]'::jsonb
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      phone: String(row.phone ?? ""),
      email: String(row.email ?? ""),
      workplaces: row.workplaces,
    };
  } catch (error) {
    if (isMissingScbEnrichmentTable(error)) return null;
    throw error;
  }
}

async function getPublishedDirectoryContact(business: PublicDirectoryBusiness) {
  const sql = getSql();
  const storedAddress = profileAddress(business);
  if (!sql) {
    return {
      organizationNumber: "",
      primarySniCode: "",
      address: EMPTY_PHYSICAL_ADDRESS,
      contact: emptyContact(),
    };
  }

  const rows = await sql`
    select
      organization_number,
      primary_sni_code,
      website_url
    from company_directory_profiles
    where id = ${business.id}::uuid
      and publication_status = 'published'
      and privacy_blocked = false
      and auto_public_eligible = true
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    return {
      organizationNumber: "",
      primarySniCode: "",
      address: EMPTY_PHYSICAL_ADDRESS,
      contact: emptyContact(),
    };
  }

  const scb = await getConflictFreeScbContact(sql, business.id);
  const address = canonicalPublishedPhysicalAddress(storedAddress, scb?.workplaces);
  return {
    organizationNumber: String(row.organization_number ?? ""),
    primarySniCode: String(row.primary_sni_code ?? ""),
    address,
    contact: discloseDirectoryDirectContact({
      addressLine1: address.addressLine1,
      phone: scb?.phone,
      email: scb?.email,
      website: row.website_url,
    }, false),
  };
}

async function getSafeClaimedDirectoryFallback(slug: string): Promise<PublicDirectoryBusinessForRequest | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select
      profile.id::text,
      profile.public_slug,
      profile.organization_number,
      profile.display_name,
      profile.legal_form,
      profile.organization_status,
      profile.category_slug,
      profile.primary_sni_code,
      profile.primary_sni_label,
      profile.activity_description,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      profile.region,
      profile.website_url,
      profile.quality_score,
      profile.official_source,
      profile.source_updated_at,
      profile.last_synced_at,
      profile.claimed_workspace_id::text,
      media.public_url as media_url,
      media.media_kind,
      media.attribution,
      media.is_actual_business_media
    from company_directory_profiles profile
    left join lateral (
      select public_url, media_kind, attribution, is_actual_business_media
      from company_directory_media
      where profile_id = profile.id and publication_status = 'published'
      order by is_primary desc, is_actual_business_media desc, created_at desc
      limit 1
    ) media on true
    where profile.public_slug = ${normalized}
      and profile.publication_status = 'claimed'
      and profile.claimed_workspace_id is not null
      and profile.published_at is not null
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const workspaceId = String(row.claimed_workspace_id ?? "");
  const entitled = await hasActivePaidDirectoryContactAccess(workspaceId);
  const scb = await getConflictFreeScbContact(sql, String(row.id));
  const address = profileAddress(row);
  const contact = discloseDirectoryDirectContact({
    addressLine1: address.addressLine1,
    phone: scb?.phone,
    email: scb?.email,
    website: row.website_url,
  }, entitled);

  return {
    id: String(row.id),
    slug: String(row.public_slug),
    companyName: String(row.display_name),
    legalForm: String(row.legal_form ?? ""),
    organizationStatus: String(row.organization_status ?? ""),
    categorySlug: String(row.category_slug ?? ""),
    primarySniLabel: String(row.primary_sni_label ?? ""),
    activityDescription: String(row.activity_description ?? ""),
    addressLine1: contact.addressLine1,
    postalCode: address.postalCode,
    city: address.city,
    municipality: address.municipality,
    region: String(row.region ?? ""),
    qualityScore: Number(row.quality_score ?? 0),
    officialSource: String(row.official_source ?? ""),
    sourceUpdatedAt: row.source_updated_at ? new Date(String(row.source_updated_at)).toISOString() : "",
    lastCheckedAt: row.last_synced_at ? new Date(String(row.last_synced_at)).toISOString() : "",
    media: row.media_url ? {
      url: String(row.media_url),
      kind: String(row.media_kind ?? ""),
      attribution: String(row.attribution ?? ""),
      isActualBusinessMedia: Boolean(row.is_actual_business_media),
    } : null,
    publicationStatus: "claimed",
    organizationNumber: String(row.organization_number ?? ""),
    primarySniCode: String(row.primary_sni_code ?? ""),
    contact,
  };
}

/**
 * Deduplicate the public directory business lookup across generateMetadata and
 * the Server Component tree for one render request. React invalidates this
 * memoization between server requests, so publication/privacy changes are not
 * persisted in an application-level cache here.
 *
 * A claimed profile may remain available as a read-only Directory fallback
 * when its previously published official data is still safe. Direct contact is
 * disclosed only when the claimed workspace has an active paid plan; Free and
 * Trial workspaces remain locked.
 */
export const getPublicDirectoryBusinessForRequest = cache(async (slug: string): Promise<PublicDirectoryBusinessForRequest | null> => {
  const published = await getPublicDirectoryBusiness(slug);
  if (published) {
    const publicContact = await getPublishedDirectoryContact(published);
    return {
      ...published,
      addressLine1: publicContact.contact.addressLine1,
      postalCode: publicContact.address.postalCode,
      city: publicContact.address.city,
      municipality: publicContact.address.municipality,
      publicationStatus: "published",
      organizationNumber: publicContact.organizationNumber,
      primarySniCode: publicContact.primarySniCode,
      contact: publicContact.contact,
    };
  }
  return getSafeClaimedDirectoryFallback(slug);
});
