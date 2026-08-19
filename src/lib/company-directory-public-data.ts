import { cache } from "react";

import { gateDirectoryDirectContact } from "@/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusiness, type PublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getSql } from "@/lib/db/server";
import { hasWorkspacePlanAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

export type PublicDirectoryBusinessForRequest = PublicDirectoryBusiness & {
  publicationStatus: "published" | "claimed";
};

async function getSafeClaimedDirectoryFallback(slug: string): Promise<PublicDirectoryBusinessForRequest | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select
      profile.id::text,
      profile.public_slug,
      profile.display_name,
      profile.legal_form,
      profile.organization_status,
      profile.category_slug,
      profile.primary_sni_label,
      profile.activity_description,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      profile.region,
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
  const directContact = gateDirectoryDirectContact(
    { addressLine1: row.address_line1 },
    await hasWorkspacePlanAccessForWorkspace(workspaceId),
  );

  return {
    id: String(row.id),
    slug: String(row.public_slug),
    companyName: String(row.display_name),
    legalForm: String(row.legal_form ?? ""),
    organizationStatus: String(row.organization_status ?? ""),
    categorySlug: String(row.category_slug ?? ""),
    primarySniLabel: String(row.primary_sni_label ?? ""),
    activityDescription: String(row.activity_description ?? ""),
    addressLine1: directContact.addressLine1,
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
    const directContact = gateDirectoryDirectContact({ addressLine1: published.addressLine1 }, false);
    return { ...published, addressLine1: directContact.addressLine1, publicationStatus: "published" };
  }
  return getSafeClaimedDirectoryFallback(slug);
});
