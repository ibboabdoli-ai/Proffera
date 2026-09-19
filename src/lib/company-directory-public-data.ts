import { cache } from "react";

import {
  discloseDirectoryDirectContact,
  type DirectoryDirectContactDisclosure,
} from "@/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusiness, type PublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { hasActivePaidDirectoryContactAccess } from "@/lib/company-directory-paid-contact-entitlement";
import {
  readPublicDirectoryMissCache,
  readPublicDirectoryProfileCache,
} from "@/lib/company-directory-public-cache";
import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  type DirectoryPublicAddress,
} from "@/lib/company-directory-scb-address";
import { DIRECTORY_PILOT_LOCATIONS } from "@/lib/company-directory-policy";
import { getSql } from "@/lib/db/server";

export type PublicDirectoryBusinessForRequest = PublicDirectoryBusiness & {
  publicationStatus: "published" | "claimed";
  organizationNumber: string;
  primarySniCode: string;
  legalName: string;
  contact: DirectoryDirectContactDisclosure;
  sharedCacheSafe: boolean;
};

type ScbDirectContact = {
  phone: string;
  email: string;
  workplaces: unknown;
};

type ClaimedOwnerPrimaryLocation = {
  visibility: string;
  isVisitable: boolean;
  confirmed: boolean;
  address: DirectoryPublicAddress;
};

type PublishedDirectoryResolution = {
  business: PublicDirectoryBusinessForRequest;
  sharedCacheSafe: boolean;
};

const PILOT_LOCATION_CSV = DIRECTORY_PILOT_LOCATIONS.join(",");

const EMPTY_PHYSICAL_ADDRESS: DirectoryPublicAddress = {
  addressLine1: "",
  postalCode: "",
  city: "",
  municipality: "",
};

function emptyContact() {
  return discloseDirectoryDirectContact({}, false);
}

export function publicDirectoryOrganizationNumber(organizationKind: unknown, value: unknown) {
  return String(organizationKind ?? "") === "juridical_person" ? String(value ?? "") : "";
}

function isMissingDirectoryTable(error: unknown, tableName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "42P01"
    && String(candidate.message ?? "").includes(tableName);
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

function ownerPrimaryPublicAddress(location: ClaimedOwnerPrimaryLocation): DirectoryPublicAddress {
  if (location.visibility === "approximate") {
    return {
      addressLine1: "",
      postalCode: "",
      city: location.address.city.trim(),
      municipality: location.address.municipality.trim(),
    };
  }

  if (
    location.visibility !== "public"
    || !location.isVisitable
    || !location.confirmed
    || !location.address.addressLine1.trim()
    || !location.address.postalCode.trim()
    || !location.address.city.trim()
    || !location.address.municipality.trim()
  ) {
    return EMPTY_PHYSICAL_ADDRESS;
  }

  return location.address;
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
    if (isMissingDirectoryTable(error, "company_directory_scb_enrichment")) return null;
    throw error;
  }
}

async function getClaimedOwnerPrimaryLocation(
  sql: NonNullable<ReturnType<typeof getSql>>,
  profileId: string,
  workspaceId: string,
): Promise<ClaimedOwnerPrimaryLocation | null> {
  try {
    const rows = await sql`
      select
        visibility,
        is_visitable,
        confirmed_at,
        address_line1,
        postal_code,
        city,
        municipality
      from company_directory_profile_locations
      where profile_id = ${profileId}::uuid
        and owner_workspace_id = ${workspaceId}::uuid
        and source_type = 'owner'
        and is_active = true
        and is_primary = true
        and purpose in ('workplace', 'storefront', 'service_base')
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      visibility: String(row.visibility ?? "private"),
      isVisitable: Boolean(row.is_visitable),
      confirmed: Boolean(row.confirmed_at),
      address: profileAddress(row),
    };
  } catch (error) {
    if (isMissingDirectoryTable(error, "company_directory_profile_locations")) return null;
    throw error;
  }
}

async function resolvePublishedPhysicalAddress(input: {
  sql: NonNullable<ReturnType<typeof getSql>>;
  profileId: string;
  claimedWorkspaceId: string;
  profile: DirectoryPublicAddress;
  workplaces: unknown;
}) {
  if (input.claimedWorkspaceId) {
    const ownerLocation = await getClaimedOwnerPrimaryLocation(
      input.sql,
      input.profileId,
      input.claimedWorkspaceId,
    );
    if (ownerLocation) return ownerPrimaryPublicAddress(ownerLocation);
  }

  return canonicalPublishedPhysicalAddress(input.profile, input.workplaces);
}

async function getPublishedDirectoryContact(business: PublicDirectoryBusiness) {
  const sql = getSql();
  const storedAddress = profileAddress(business);
  if (!sql) {
    return {
      organizationNumber: "",
      primarySniCode: "",
      legalName: "",
      address: EMPTY_PHYSICAL_ADDRESS,
      contact: emptyContact(),
      claimedWorkspaceId: "",
      officialFactsCheckedAt: "",
    };
  }

  const rows = await sql`
    select
      organization_number,
      organization_kind,
      legal_name,
      primary_sni_code,
      website_url,
      claimed_workspace_id::text,
      (
        select facts.last_synced_at
        from company_directory_official_facts facts
        where facts.profile_id = company_directory_profiles.id
        limit 1
      ) as official_facts_last_synced_at
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
      legalName: "",
      address: EMPTY_PHYSICAL_ADDRESS,
      contact: emptyContact(),
      claimedWorkspaceId: "",
      officialFactsCheckedAt: "",
    };
  }

  const scb = await getConflictFreeScbContact(sql, business.id);
  const claimedWorkspaceId = String(row.claimed_workspace_id ?? "");
  const address = await resolvePublishedPhysicalAddress({
    sql,
    profileId: business.id,
    claimedWorkspaceId,
    profile: storedAddress,
    workplaces: scb?.workplaces,
  });
  return {
    organizationNumber: publicDirectoryOrganizationNumber(row.organization_kind, row.organization_number),
    primarySniCode: String(row.primary_sni_code ?? ""),
    legalName: String(row.legal_name ?? ""),
    address,
    contact: discloseDirectoryDirectContact({
      addressLine1: address.addressLine1,
      phone: scb?.phone,
      email: scb?.email,
      website: row.website_url,
    }, false),
    claimedWorkspaceId,
    officialFactsCheckedAt: row.official_facts_last_synced_at
      ? new Date(String(row.official_facts_last_synced_at)).toISOString()
      : "",
  };
}

async function resolvePublishedDirectoryBusiness(slug: string): Promise<PublishedDirectoryResolution | null> {
  const published = await getPublicDirectoryBusiness(slug);
  if (!published) return null;
  const publicContact = await getPublishedDirectoryContact(published);
  const sharedCacheSafe = Boolean(publicContact.organizationNumber) && !publicContact.claimedWorkspaceId;
  return {
    business: {
      ...published,
      lastCheckedAt: publicContact.officialFactsCheckedAt,
      addressLine1: publicContact.contact.addressLine1,
      postalCode: publicContact.address.postalCode,
      city: publicContact.address.city,
      municipality: publicContact.address.municipality,
      publicationStatus: "published",
      organizationNumber: publicContact.organizationNumber,
      primarySniCode: publicContact.primarySniCode,
      legalName: publicContact.legalName,
      contact: publicContact.contact,
      sharedCacheSafe,
    },
    sharedCacheSafe,
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
      profile.organization_kind,
      profile.legal_name,
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
      facts.last_synced_at as official_facts_last_synced_at,
      profile.claimed_workspace_id::text,
      media.public_url as media_url,
      media.media_kind,
      media.attribution,
      media.is_actual_business_media
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
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
      and (
        (
          profile.organization_kind = 'juridical_person'
          and exists (
            select 1
            from company_directory_official_facts claimed_facts
            join company_directory_scb_enrichment claimed_scb
              on claimed_scb.profile_id = claimed_facts.profile_id
            where claimed_facts.profile_id = profile.id
              and claimed_facts.source_payload_hash <> ''
              and claimed_facts.last_synced_at >= profile.last_synced_at
              and claimed_facts.deregistration_date is null
              and coalesce(claimed_facts.advertising_blocked, false) = false
              and (
                case
                  when jsonb_typeof(claimed_facts.ongoing_procedures) = 'array'
                    then jsonb_array_length(claimed_facts.ongoing_procedures)
                  else 1
                end
              ) = 0
              and claimed_scb.source_payload_hash <> ''
              and claimed_scb.last_synced_at >= now() - interval '7 days'
              and claimed_scb.last_synced_at >= profile.last_synced_at
              and claimed_scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = claimed_facts.last_synced_at::text
              and jsonb_typeof(claimed_scb.conflicts) = 'array'
              and jsonb_array_length(claimed_scb.conflicts) = 0
              and jsonb_typeof(claimed_scb.workplaces) = 'array'
              and jsonb_array_length(claimed_scb.workplaces) = 1
              and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'addressLine'), '') is not null
              and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'postalCode'), '') is not null
              and nullif(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'city'), '') is not null
              and nullif(btrim(claimed_scb.workplaces->0->>'municipality'), '') is not null
              and (
                lower(btrim(claimed_scb.workplaces->0->'visitingAddress'->>'city')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                or lower(btrim(claimed_scb.workplaces->0->>'municipality')) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
              )
          )
        )
        or (
          profile.organization_kind = 'sole_trader'
          and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
          and exists (
            select 1
            from company_directory_claims owner_claim
            where owner_claim.profile_id = profile.id
              and owner_claim.requested_workspace_id = profile.claimed_workspace_id
              and owner_claim.status = 'claimed'
              and owner_claim.verification_method = 'manual_review'
          )
          and exists (
            select 1
            from company_directory_profile_locations owner_base
            where owner_base.profile_id = profile.id
              and owner_base.owner_workspace_id = profile.claimed_workspace_id
              and owner_base.source_type = 'owner'
              and owner_base.purpose = 'service_base'
              and owner_base.is_active = true
              and owner_base.is_primary = true
              and owner_base.confirmed_at is not null
              and owner_base.latitude is not null
              and owner_base.longitude is not null
              and not (owner_base.latitude = 0 and owner_base.longitude = 0)
              and owner_base.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'
              and owner_base.geocode_precision = 'address'
              and (
                lower(btrim(owner_base.city)) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
                or lower(btrim(owner_base.municipality)) = any(string_to_array(${PILOT_LOCATION_CSV}, ','))
              )
          )
        )
      )
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const profileId = String(row.id ?? "").trim();
  const publicSlug = String(row.public_slug ?? "").trim().toLowerCase();
  const workspaceId = String(row.claimed_workspace_id ?? "").trim();
  if (!profileId || publicSlug !== normalized || !workspaceId) return null;

  const entitled = await hasActivePaidDirectoryContactAccess(workspaceId);
  const scb = await getConflictFreeScbContact(sql, profileId);
  const address = await resolvePublishedPhysicalAddress({
    sql,
    profileId,
    claimedWorkspaceId: workspaceId,
    profile: profileAddress(row),
    workplaces: scb?.workplaces,
  });
  const contact = discloseDirectoryDirectContact({
    addressLine1: address.addressLine1,
    phone: scb?.phone,
    email: scb?.email,
    website: row.website_url,
  }, entitled);

  return {
    id: profileId,
    slug: publicSlug,
    companyName: String(row.display_name),
    legalName: String(row.legal_name ?? ""),
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
    lastCheckedAt: row.official_facts_last_synced_at
      ? new Date(String(row.official_facts_last_synced_at)).toISOString()
      : "",
    media: row.media_url ? {
      url: String(row.media_url),
      kind: String(row.media_kind ?? ""),
      attribution: String(row.attribution ?? ""),
      isActualBusinessMedia: Boolean(row.is_actual_business_media),
    } : null,
    publicationStatus: "claimed",
    organizationNumber: publicDirectoryOrganizationNumber(row.organization_kind, row.organization_number),
    primarySniCode: String(row.primary_sni_code ?? ""),
    contact,
    sharedCacheSafe: false,
  };
}

/**
 * React cache deduplicates metadata + Server Component work inside one render.
 * The nested public-cache boundary absorbs cross-request traffic only for safe
 * published, unclaimed juridical-person snapshots. A second short miss cache
 * absorbs repeated crawler requests for slugs that have no public or claimed
 * Directory profile. Claimed and sole-trader results always bypass persistence
 * so entitlement and ownership state remain request-fresh.
 */
export const getPublicDirectoryBusinessForRequest = cache(async (slug: string): Promise<PublicDirectoryBusinessForRequest | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;

  return readPublicDirectoryMissCache(normalized, async () => {
    const published = await readPublicDirectoryProfileCache(normalized, async () => {
      const resolved = await resolvePublishedDirectoryBusiness(normalized);
      return resolved?.sharedCacheSafe
        ? { cache: true, value: resolved.business }
        : { cache: false, value: resolved?.business ?? null };
    });
    if (published) return { cache: false, value: published };

    // A missing SQL client is an indeterminate infrastructure state, not proof
    // that the Directory slug is absent. Never persist it as a negative cache.
    if (!getSql()) return { cache: false, value: null };

    const claimed = await getSafeClaimedDirectoryFallback(normalized);
    return claimed
      ? { cache: false, value: claimed }
      : { cache: true, value: null };
  });
});
