import { cache } from "react";

import {
  discloseDirectoryDirectContact,
  type DirectoryDirectContactDisclosure,
} from "@/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusiness, type PublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getSql } from "@/lib/db/server";
import { hasWorkspacePlanAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

export type PublicDirectoryBusinessForRequest = PublicDirectoryBusiness & {
  publicationStatus: "published" | "claimed";
  organizationNumber: string;
  primarySniCode: string;
  contact: DirectoryDirectContactDisclosure;
};

function emptyContact() {
  return discloseDirectoryDirectContact({}, false);
}

async function getPublishedDirectoryContact(profileId: string) {
  const sql = getSql();
  if (!sql) {
    return {
      organizationNumber: "",
      primarySniCode: "",
      contact: emptyContact(),
    };
  }

  const rows = await sql`
    select
      profile.organization_number,
      profile.primary_sni_code,
      profile.website_url,
      coalesce(nullif(scb.phone, ''), '') as phone,
      coalesce(nullif(scb.email, ''), '') as email,
      coalesce(nullif(scb.postal_address->>'addressLine', ''), nullif(profile.address_line1, ''), '') as direct_address_line1
    from company_directory_profiles profile
    left join company_directory_scb_enrichment scb
      on scb.profile_id = profile.id
      and scb.conflicts = '[]'::jsonb
    where profile.id = ${profileId}::uuid
      and profile.publication_status = 'published'
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    return {
      organizationNumber: "",
      primarySniCode: "",
      contact: emptyContact(),
    };
  }

  return {
    organizationNumber: String(row.organization_number ?? ""),
    primarySniCode: String(row.primary_sni_code ?? ""),
    contact: discloseDirectoryDirectContact({
      addressLine1: row.direct_address_line1,
      phone: row.phone,
      email: row.email,
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
      coalesce(nullif(scb.phone, ''), '') as phone,
      coalesce(nullif(scb.email, ''), '') as email,
      coalesce(nullif(scb.postal_address->>'addressLine', ''), nullif(profile.address_line1, ''), '') as direct_address_line1,
      media.public_url as media_url,
      media.media_kind,
      media.attribution,
      media.is_actual_business_media
    from company_directory_profiles profile
    left join company_directory_scb_enrichment scb
      on scb.profile_id = profile.id
      and scb.conflicts = '[]'::jsonb
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
  const entitled = await hasWorkspacePlanAccessForWorkspace(workspaceId);
  const contact = discloseDirectoryDirectContact({
    addressLine1: row.direct_address_line1,
    phone: row.phone,
    email: row.email,
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
    postalCode: String(row.postal_code ?? ""),
    city: String(row.city ?? ""),
    municipality: String(row.municipality ?? ""),
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
 * when its previously published official data is still safe. This prevents a
 * Starter claim from making a company disappear before a public Business Page
 * is entitled/configured.
 */
export const getPublicDirectoryBusinessForRequest = cache(async (slug: string): Promise<PublicDirectoryBusinessForRequest | null> => {
  const published = await getPublicDirectoryBusiness(slug);
  if (published) {
    const publicContact = await getPublishedDirectoryContact(published.id);
    return {
      ...published,
      addressLine1: publicContact.contact.addressLine1,
      publicationStatus: "published",
      organizationNumber: publicContact.organizationNumber,
      primarySniCode: publicContact.primarySniCode,
      contact: publicContact.contact,
    };
  }
  return getSafeClaimedDirectoryFallback(slug);
});
