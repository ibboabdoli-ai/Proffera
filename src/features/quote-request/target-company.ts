import "server-only";

import { getSql } from "@/lib/db/server";
import { serviceCategoryForQuoteCategory } from "@/lib/service-catalog";

export type QuoteTargetCompany = {
  profileId: string;
  slug: string;
  companyName: string;
  categorySlug: string;
};

const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeQuoteTargetProfileSlug(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (!normalized || normalized.length > 180 || !PROFILE_SLUG_PATTERN.test(normalized)) return "";
  return normalized;
}

export async function getQuoteTargetCompany(
  requestedSlug: unknown,
  quoteCategory?: string,
): Promise<QuoteTargetCompany | null> {
  const slug = normalizeQuoteTargetProfileSlug(requestedSlug);
  if (!slug) return null;

  const requiredCategory = quoteCategory ? serviceCategoryForQuoteCategory(quoteCategory) : null;
  if (quoteCategory && !requiredCategory) return null;

  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      select
        profile.id::text as profile_id,
        profile.public_slug,
        profile.display_name,
        profile.category_slug
      from company_directory_profiles profile
      where profile.public_slug = ${slug}
        and profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
        and profile.organization_kind = 'juridical_person'
        and profile.claimed_workspace_id is null
        and (${requiredCategory}::text is null or profile.category_slug = ${requiredCategory})
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      profileId: text(row.profile_id),
      slug: text(row.public_slug),
      companyName: text(row.display_name),
      categorySlug: text(row.category_slug),
    };
  } catch (error) {
    console.error("Failed to resolve Marketplace quote target company", { slug, error });
    return null;
  }
}
