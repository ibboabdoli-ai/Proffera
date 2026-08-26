import "server-only";

import { businessEmailDomainKind, validBusinessEmail } from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";

const VERIFIED_GEOCODE_SOURCE = "lantmateriet_belagenhetsadress_v4_2";
const READINESS_QUEUE_LIMIT = 150;

export type DirectoryMarketplaceAddress = {
  addressLine1: string;
  postalCode: string;
  city: string;
  source: "scb_visiting_address" | "scb_postal_address";
};

export type DirectoryMarketplaceReadiness = {
  eligible: boolean;
  guestEligible: boolean;
  marketplaceReady: boolean;
  autoOutreachReady: boolean;
  needsGeocoding: boolean;
  needsContact: boolean;
  needsLocationSource: boolean;
  potentialAutoOutreachAfterGeocoding: boolean;
  address: DirectoryMarketplaceAddress | null;
  businessEmail: string;
  phone: string;
  hasVerifiedCoordinates: boolean;
  reasons: string[];
};

export type DirectoryMarketplaceReadinessRow = DirectoryMarketplaceReadiness & {
  profileId: string;
  organizationNumber: string;
  companyName: string;
  publicSlug: string;
  city: string;
  municipality: string;
  claimed: boolean;
};

export type DirectoryMarketplaceReadinessReport = {
  generatedAt: string;
  publishedActive: number;
  loaded: number;
  marketplaceReady: number;
  autoOutreachReady: number;
  needsGeocoding: number;
  needsContact: number;
  needsLocationSource: number;
  rows: DirectoryMarketplaceReadinessRow[];
};

type AddressCandidate = {
  addressLine?: unknown;
  postalCode?: unknown;
  city?: unknown;
};

type WorkplaceCandidate = {
  visitingAddress?: AddressCandidate | null;
  postalAddress?: AddressCandidate | null;
};

type AddressResolution = {
  address: DirectoryMarketplaceAddress | null;
  ambiguous: boolean;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function boxLikeAddress(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("sv-SE");
  return /^box(?:\s|:|$)/.test(normalized)
    || /^post\s*box(?:\s|:|$)/.test(normalized)
    || /^kivra(?:\s|:|$)/.test(normalized);
}

function normalizedAddress(
  candidate: AddressCandidate | null | undefined,
  source: DirectoryMarketplaceAddress["source"],
) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const addressLine1 = text(candidate.addressLine);
  const postalCode = text(candidate.postalCode);
  const city = text(candidate.city);
  if (!addressLine1 || !postalCode || !city || boxLikeAddress(addressLine1)) return null;
  return { addressLine1, postalCode, city, source } satisfies DirectoryMarketplaceAddress;
}

function addressKey(address: DirectoryMarketplaceAddress) {
  return [address.addressLine1, address.postalCode, address.city]
    .map((value) => value.normalize("NFKC").toLocaleLowerCase("sv-SE").replace(/\s+/g, " ").trim())
    .join("|");
}

function uniqueAddresses(addresses: DirectoryMarketplaceAddress[]) {
  const unique = new Map<string, DirectoryMarketplaceAddress>();
  for (const address of addresses) unique.set(addressKey(address), address);
  return [...unique.values()];
}

function resolveDirectoryMarketplaceWorkplaceAddress(workplaces: unknown): AddressResolution {
  const parsed = parseJsonArray(workplaces).filter(
    (item): item is WorkplaceCandidate => Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );

  const visiting = uniqueAddresses(parsed
    .map((workplace) => normalizedAddress(workplace.visitingAddress, "scb_visiting_address"))
    .filter((address): address is DirectoryMarketplaceAddress => Boolean(address)));
  if (visiting.length === 1) return { address: visiting[0], ambiguous: false };
  if (visiting.length > 1) return { address: null, ambiguous: true };

  const postal = uniqueAddresses(parsed
    .map((workplace) => normalizedAddress(workplace.postalAddress, "scb_postal_address"))
    .filter((address): address is DirectoryMarketplaceAddress => Boolean(address)));
  if (postal.length === 1) return { address: postal[0], ambiguous: false };
  if (postal.length > 1) return { address: null, ambiguous: true };
  return { address: null, ambiguous: false };
}

export function selectDirectoryMarketplaceWorkplaceAddress(workplaces: unknown): DirectoryMarketplaceAddress | null {
  return resolveDirectoryMarketplaceWorkplaceAddress(workplaces).address;
}

function hasScbConflicts(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length > 0 : true;
  } catch {
    return true;
  }
}

function safeBusinessEmail(value: unknown, conflicts: unknown) {
  if (hasScbConflicts(conflicts)) return "";
  const email = text(value).toLowerCase();
  if (!validBusinessEmail(email) || businessEmailDomainKind(email) !== "business_domain") return "";
  return email;
}

function safePhone(value: unknown, conflicts: unknown) {
  if (hasScbConflicts(conflicts)) return "";
  const phone = text(value);
  if (!phone || !/^[+\d\s().-]+$/.test(phone)) return "";
  const normalized = phone.replace(/[\s().-]/g, "");
  return /^\+?\d{7,15}$/.test(normalized) ? phone : "";
}

function advertisingBlockedState(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1" || text(value).toLowerCase() === "true") return true;
  if (value === false || value === 0 || value === "0" || text(value).toLowerCase() === "false") return false;
  return null;
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function isVerifiedDirectoryMarketplaceLocation(input: {
  latitude?: unknown;
  longitude?: unknown;
  geocodeSource?: unknown;
  geocodePrecision?: unknown;
  geocodeConfidence?: unknown;
  geocodedAt?: unknown;
  locationIsPublic?: unknown;
}) {
  const latitude = finiteCoordinate(input.latitude, -90, 90);
  const longitude = finiteCoordinate(input.longitude, -180, 180);
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) return false;
  return Boolean(input.locationIsPublic)
    && text(input.geocodeSource) === VERIFIED_GEOCODE_SOURCE
    && text(input.geocodePrecision) === "address"
    && Number(input.geocodeConfidence) === 100
    && Boolean(text(input.geocodedAt));
}

export function classifyDirectoryMarketplaceReadiness(input: {
  publicationStatus: unknown;
  isActive: unknown;
  privacyBlocked: unknown;
  organizationKind: unknown;
  claimedWorkspaceId?: unknown;
  hasPublicService: unknown;
  advertisingBlocked?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  geocodeSource?: unknown;
  geocodePrecision?: unknown;
  geocodeConfidence?: unknown;
  geocodedAt?: unknown;
  locationIsPublic?: unknown;
  scbWorkplaces?: unknown;
  scbEmail?: unknown;
  scbPhone?: unknown;
  scbConflicts?: unknown;
}): DirectoryMarketplaceReadiness {
  const reasons: string[] = [];
  const claimed = Boolean(text(input.claimedWorkspaceId));
  const conflicts = hasScbConflicts(input.scbConflicts);
  const advertisingBlocked = advertisingBlockedState(input.advertisingBlocked);
  const eligible = text(input.publicationStatus) === "published"
    && Boolean(input.isActive)
    && !Boolean(input.privacyBlocked)
    && text(input.organizationKind) === "juridical_person"
    && Boolean(input.hasPublicService)
    && !conflicts;
  const guestEligible = eligible && !claimed;

  if (text(input.publicationStatus) !== "published") reasons.push("not_published");
  if (!Boolean(input.isActive)) reasons.push("inactive");
  if (Boolean(input.privacyBlocked)) reasons.push("privacy_blocked");
  if (text(input.organizationKind) !== "juridical_person") reasons.push("not_juridical_person");
  if (!Boolean(input.hasPublicService)) reasons.push("no_public_service");
  if (conflicts) reasons.push("scb_conflict");
  if (claimed) reasons.push("claimed_workspace_route");
  if (guestEligible && advertisingBlocked === true) reasons.push("advertising_blocked");
  if (guestEligible && advertisingBlocked === null) reasons.push("advertising_block_unknown");

  const location = resolveDirectoryMarketplaceWorkplaceAddress(input.scbWorkplaces);
  const address = location.address;
  const hasVerifiedCoordinates = isVerifiedDirectoryMarketplaceLocation(input);
  const businessEmail = safeBusinessEmail(input.scbEmail, input.scbConflicts);
  const phone = safePhone(input.scbPhone, input.scbConflicts);
  const hasReachableContact = Boolean(businessEmail || phone);

  if (eligible && location.ambiguous) reasons.push("ambiguous_workplace");
  else if (eligible && !address) reasons.push("missing_workplace_address");
  if (eligible && address && !hasVerifiedCoordinates) reasons.push("needs_geocoding");
  if (eligible && !hasReachableContact) reasons.push("needs_contact");

  const marketplaceReady = eligible && Boolean(address) && hasVerifiedCoordinates && hasReachableContact;
  const autoOutreachReady = guestEligible
    && marketplaceReady
    && Boolean(businessEmail)
    && advertisingBlocked === false;
  if (marketplaceReady) reasons.push("marketplace_ready");
  if (autoOutreachReady) reasons.push("auto_outreach_ready");

  return {
    eligible,
    guestEligible,
    marketplaceReady,
    autoOutreachReady,
    needsGeocoding: eligible && Boolean(address) && !hasVerifiedCoordinates,
    needsContact: eligible && !hasReachableContact,
    needsLocationSource: eligible && !address,
    potentialAutoOutreachAfterGeocoding: guestEligible
      && Boolean(address)
      && !hasVerifiedCoordinates
      && Boolean(businessEmail)
      && advertisingBlocked === false,
    address,
    businessEmail,
    phone,
    hasVerifiedCoordinates,
    reasons,
  };
}

function emptyReport(): DirectoryMarketplaceReadinessReport {
  return {
    generatedAt: new Date().toISOString(),
    publishedActive: 0,
    loaded: 0,
    marketplaceReady: 0,
    autoOutreachReady: 0,
    needsGeocoding: 0,
    needsContact: 0,
    needsLocationSource: 0,
    rows: [],
  };
}

export async function getCompanyDirectoryMarketplaceReadinessReport(): Promise<DirectoryMarketplaceReadinessReport> {
  const sql = getSql();
  if (!sql) return emptyReport();

  const [countRows, rows] = await Promise.all([
    sql`
      select count(*)::int as published_active
      from company_directory_profiles profile
      where profile.publication_status = 'published'
        and profile.is_active = true
    `,
    sql`
      select
        profile.id::text as profile_id,
        profile.organization_number,
        profile.display_name,
        profile.public_slug,
        profile.city,
        profile.municipality,
        profile.publication_status,
        profile.is_active,
        profile.privacy_blocked,
        profile.organization_kind,
        profile.claimed_workspace_id::text as claimed_workspace_id,
        facts.advertising_blocked,
        location.latitude::float8 as latitude,
        location.longitude::float8 as longitude,
        location.geocode_source,
        location.geocode_precision,
        location.geocode_confidence,
        location.geocoded_at::text as geocoded_at,
        location.is_public as location_is_public,
        scb.email as scb_email,
        scb.phone as scb_phone,
        scb.workplaces as scb_workplaces,
        scb.conflicts as scb_conflicts,
        exists (
          select 1
          from company_directory_profile_services relation
          where relation.profile_id = profile.id
            and relation.is_active = true
            and relation.public_visible = true
        ) as has_public_service
      from company_directory_profiles profile
      left join company_directory_business_locations location
        on location.profile_id = profile.id
      left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
      left join company_directory_official_facts facts on facts.profile_id = profile.id
      where profile.publication_status = 'published'
        and profile.is_active = true
      order by
        case when coalesce(scb.email, '') <> '' then 0 else 1 end,
        case when jsonb_array_length(coalesce(scb.workplaces, '[]'::jsonb)) > 0 then 0 else 1 end,
        profile.display_name asc,
        profile.id asc
      limit ${READINESS_QUEUE_LIMIT}
    `,
  ]);

  const classified = (rows as Record<string, unknown>[]).map((row): DirectoryMarketplaceReadinessRow => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: row.publication_status,
      isActive: row.is_active,
      privacyBlocked: row.privacy_blocked,
      organizationKind: row.organization_kind,
      claimedWorkspaceId: row.claimed_workspace_id,
      hasPublicService: row.has_public_service,
      advertisingBlocked: row.advertising_blocked,
      latitude: row.latitude,
      longitude: row.longitude,
      geocodeSource: row.geocode_source,
      geocodePrecision: row.geocode_precision,
      geocodeConfidence: row.geocode_confidence,
      geocodedAt: row.geocoded_at,
      locationIsPublic: row.location_is_public,
      scbWorkplaces: row.scb_workplaces,
      scbEmail: row.scb_email,
      scbPhone: row.scb_phone,
      scbConflicts: row.scb_conflicts,
    });
    return {
      ...readiness,
      profileId: text(row.profile_id),
      organizationNumber: text(row.organization_number),
      companyName: text(row.display_name),
      publicSlug: text(row.public_slug),
      city: text(row.city),
      municipality: text(row.municipality),
      claimed: Boolean(text(row.claimed_workspace_id)),
    };
  });

  const priorityRows = [...classified].sort((left, right) => {
    const priority = (row: DirectoryMarketplaceReadinessRow) => {
      if (row.potentialAutoOutreachAfterGeocoding) return 0;
      if (row.needsGeocoding) return 1;
      if (row.needsContact) return 2;
      if (row.needsLocationSource) return 3;
      if (row.autoOutreachReady) return 4;
      if (row.marketplaceReady) return 5;
      return 6;
    };
    return priority(left) - priority(right)
      || left.companyName.localeCompare(right.companyName, "sv");
  });

  const publishedActive = Number((countRows as Record<string, unknown>[])[0]?.published_active ?? 0);
  return {
    generatedAt: new Date().toISOString(),
    publishedActive,
    loaded: classified.length,
    marketplaceReady: classified.filter((row) => row.marketplaceReady).length,
    autoOutreachReady: classified.filter((row) => row.autoOutreachReady).length,
    needsGeocoding: classified.filter((row) => row.needsGeocoding).length,
    needsContact: classified.filter((row) => row.needsContact).length,
    needsLocationSource: classified.filter((row) => row.needsLocationSource).length,
    rows: priorityRows,
  };
}
