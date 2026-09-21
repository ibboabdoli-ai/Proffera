import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { searchPublishedBusinessProfiles } from "@/lib/business-profile-search";
import { PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG } from "@/lib/company-directory-public-cache";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import { getSql } from "@/lib/db/server";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

export { PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG };

// Location suggestions are public, low-volatility labels. Keep them warm for a
// day so bare Directory landing requests do not periodically wake Neon. Actual
// Search/Nearby results remain live and outside this cache.
const LOCATION_SUGGESTIONS_REVALIDATE_SECONDS = 24 * 60 * 60;
const MARKETPLACE_HOME_COMPANIES_REVALIDATE_SECONDS = 30 * 60;
export const MARKETPLACE_HOME_COMPANIES_CACHE_TAG = "marketplace-home-companies:v1";
const PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS = 30 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DirectoryLocationSuggestions = Awaited<ReturnType<typeof getPublishedDirectoryLocationSuggestions>>;
type DirectoryLocationSuggestionsCacheEnvelope = {
  value: DirectoryLocationSuggestions;
  authorityBound: boolean;
  authorityExpiresAt: string | null;
};

type MarketplaceHomeCompanies = Awaited<ReturnType<typeof searchPublishedBusinessProfiles>>;
type MarketplaceHomeCompaniesCacheEnvelope = {
  value: MarketplaceHomeCompanies;
  authorityBound: boolean;
  authorityExpiresAt: string | null;
};

async function locationSuggestionsAuthorityBoundary(value: DirectoryLocationSuggestions) {
  if (value.length === 0) {
    return { authorityBound: true, authorityExpiresAt: null };
  }

  const sql = getSql();
  if (!sql) return { authorityBound: false, authorityExpiresAt: null };

  try {
    const rows = await sql`
      select
        count(*)::int as juridical_count,
        min(scb.last_synced_at + interval '7 days') as authority_expires_at
      from company_directory_profiles profile
      join company_directory_official_facts facts
        on facts.profile_id = profile.id
      join company_directory_scb_enrichment scb
        on scb.profile_id = profile.id
      left join workspaces claimed_workspace
        on claimed_workspace.id = profile.claimed_workspace_id
      where profile.organization_kind = 'juridical_person'
        and profile.publication_status in ('published', 'claimed')
        and profile.is_active = true
        and profile.privacy_blocked = false
        and profile.auto_public_eligible = true
        and (
          profile.publication_status = 'published'
          or (
            profile.claimed_workspace_id is not null
            and profile.published_at is not null
            and claimed_workspace.status in ('active', 'trial')
          )
        )
        and facts.source_payload_hash <> ''
        and facts.last_synced_at >= profile.last_synced_at
        and facts.deregistration_date is null
        and coalesce(facts.advertising_blocked, false) = false
        and (
          case
            when jsonb_typeof(facts.ongoing_procedures) = 'array'
              then jsonb_array_length(facts.ongoing_procedures)
            else 1
          end
        ) = 0
        and scb.source_payload_hash <> ''
        and scb.last_synced_at >= now() - interval '7 days'
        and scb.last_synced_at >= profile.last_synced_at
        and (
          profile.publication_status = 'claimed'
          or scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
        )
        and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
        and jsonb_typeof(scb.conflicts) = 'array'
        and jsonb_array_length(scb.conflicts) = 0
        and jsonb_typeof(scb.workplaces) = 'array'
        and jsonb_array_length(scb.workplaces) = 1
    `;
    const row = rows[0];
    const juridicalCount = Number(row?.juridical_count ?? 0);
    if (juridicalCount === 0) {
      return { authorityBound: true, authorityExpiresAt: null };
    }

    const expiresAt = row?.authority_expires_at ? new Date(String(row.authority_expires_at)) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime())) {
      return { authorityBound: false, authorityExpiresAt: null };
    }
    return { authorityBound: true, authorityExpiresAt: expiresAt.toISOString() };
  } catch {
    // Location labels are derived from live authority-gated rows. If their
    // time boundary cannot be proven, bypass the cross-request cache.
    return { authorityBound: false, authorityExpiresAt: null };
  }
}

async function marketplaceHomeAuthorityBoundary(value: MarketplaceHomeCompanies) {
  const profileIds = value.results
    .map((result) => String(result.id ?? "").trim().toLowerCase())
    .filter((profileId) => UUID_PATTERN.test(profileId));

  if (value.results.length === 0) {
    return { authorityBound: true, authorityExpiresAt: null };
  }
  if (profileIds.length !== value.results.length) {
    return { authorityBound: false, authorityExpiresAt: null };
  }

  const sql = getSql();
  if (!sql) return { authorityBound: false, authorityExpiresAt: null };

  try {
    const profileIdCsv = profileIds.join(",");
    const rows = await sql`
      select
        count(*)::int as profile_count,
        count(*) filter (where profile.organization_kind = 'juridical_person')::int as juridical_count,
        min(scb.last_synced_at + interval '7 days')
          filter (where profile.organization_kind = 'juridical_person') as authority_expires_at
      from company_directory_profiles profile
      left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
      where profile.id = any(string_to_array(${profileIdCsv}, ',')::uuid[])
    `;
    const row = rows[0];
    const profileCount = Number(row?.profile_count ?? 0);
    const juridicalCount = Number(row?.juridical_count ?? 0);
    if (profileCount !== profileIds.length) {
      return { authorityBound: false, authorityExpiresAt: null };
    }
    if (juridicalCount === 0) {
      return { authorityBound: true, authorityExpiresAt: null };
    }

    const expiresAt = row?.authority_expires_at ? new Date(String(row.authority_expires_at)) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime())) {
      return { authorityBound: false, authorityExpiresAt: null };
    }
    return { authorityBound: true, authorityExpiresAt: expiresAt.toISOString() };
  } catch {
    // The live search remains the canonical fail-closed path. If the cache
    // deadline cannot be proven, mark this envelope unsafe for reuse.
    return { authorityBound: false, authorityExpiresAt: null };
  }
}

const readCachedPublishedDirectoryLocationSuggestions = unstable_cache(
  async (limit: number): Promise<DirectoryLocationSuggestionsCacheEnvelope> => {
    const value = await getPublishedDirectoryLocationSuggestions(limit);
    const authority = await locationSuggestionsAuthorityBoundary(value);
    return { value, ...authority };
  },
  ["public-directory-location-suggestions-v5"],
  {
    revalidate: LOCATION_SUGGESTIONS_REVALIDATE_SECONDS,
    tags: [PUBLIC_DIRECTORY_LOCATION_SUGGESTIONS_CACHE_TAG],
  },
);

const readCachedMarketplaceHomeCompanies = unstable_cache(
  async (limit: number): Promise<MarketplaceHomeCompaniesCacheEnvelope> => {
    const value = await searchPublishedBusinessProfiles({ limit, sort: "recommended" });
    const authority = await marketplaceHomeAuthorityBoundary(value);
    return { value, ...authority };
  },
  ["marketplace-home-companies-v4"],
  {
    revalidate: MARKETPLACE_HOME_COMPANIES_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_HOME_COMPANIES_CACHE_TAG],
  },
);

const readCachedPublicBusinessSitemapEntries = unstable_cache(
  async () => listPublicBusinessSitemapEntries(),
  ["platform-public-business-sitemap-v1"],
  { revalidate: PUBLIC_BUSINESS_SITEMAP_REVALIDATE_SECONDS },
);

export async function getCachedPublishedDirectoryLocationSuggestions(limit = 24) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const safeLimit = Math.max(1, Math.min(100, Math.floor(normalizedLimit)));
  const cached = await readCachedPublishedDirectoryLocationSuggestions(safeLimit);

  if (!cached.authorityBound) {
    return getPublishedDirectoryLocationSuggestions(safeLimit);
  }
  if (cached.authorityExpiresAt) {
    const expiresAt = Date.parse(cached.authorityExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return getPublishedDirectoryLocationSuggestions(safeLimit);
    }
  }

  return cached.value;
}

export async function getCachedMarketplaceHomeCompanies(limit = 4) {
  const parsedLimit = Number(limit);
  const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 4;
  const safeLimit = Math.max(1, Math.min(8, Math.floor(normalizedLimit)));
  const cached = await readCachedMarketplaceHomeCompanies(safeLimit);

  if (!cached.authorityBound) {
    return searchPublishedBusinessProfiles({ limit: safeLimit, sort: "recommended" });
  }
  if (cached.authorityExpiresAt) {
    const expiresAt = Date.parse(cached.authorityExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return searchPublishedBusinessProfiles({ limit: safeLimit, sort: "recommended" });
    }
  }

  return cached.value;
}

export async function getCachedPublicBusinessSitemapEntries() {
  return readCachedPublicBusinessSitemapEntries();
}

export function invalidateMarketplaceHomeCompaniesCache() {
  revalidateTag(MARKETPLACE_HOME_COMPANIES_CACHE_TAG, { expire: 0 });
}
