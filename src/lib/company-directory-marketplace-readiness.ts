import "server-only";

import { businessEmailDomainKind, validBusinessEmail } from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";

export type DirectoryMarketplaceAddress = {
  addressLine1: string;
  postalCode: string;
  city: string;
  source: "scb_visiting_address" | "scb_postal_address";
};

export type DirectoryMarketplaceReadiness = {
  eligible: boolean;
  marketplaceReady: boolean;
  autoOutreachReady: boolean;
  needsGeocoding: boolean;
  needsContact: boolean;
  needsLocationSource: boolean;
  potentialAutoOutreachAfterGeocoding: boolean;
  address: DirectoryMarketplaceAddress | null;
  businessEmail: string;
  phone: string;
  hasCoordinates: boolean;
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
  guestEligible: number;
  withUsableWorkplaceAddress: number;
  withReachableContact: number;
  withBusinessEmail: number;
  withPhone: number;
  geocoded: number;
  marketplaceReady: number;
  autoOutreachReady: number;
  needsGeocoding: number;
  needsContact: number;
  needsLocationSource: number;
  potentialAutoOutreachAfterGeocoding: number;
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

function normalizedAddress(candidate: AddressCandidate | null | undefined, source: DirectoryMarketplaceAddress["source"]) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const addressLine1 = text(candidate.addressLine);
  const postalCode = text(candidate.postalCode);
  const city = text(candidate.city);
  if (!addressLine1 || !postalCode || !city || boxLikeAddress(addressLine1)) return null;
  return { addressLine1, postalCode, city, source } satisfies DirectoryMarketplaceAddress;
}

export function selectDirectoryMarketplaceWorkplaceAddress(workplaces: unknown): DirectoryMarketplaceAddress | null {
  const parsed = parseJsonArray(workplaces).filter(
    (item): item is WorkplaceCandidate => Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );

  for (const workplace of parsed) {
    const visiting = normalizedAddress(workplace.visitingAddress, "scb_visiting_address");
    if (visiting) return visiting;
  }
  for (const workplace of parsed) {
    const postal = normalizedAddress(workplace.postalAddress, "scb_postal_address");
    if (postal) return postal;
  }
  return null;
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
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? phone : "";
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function classifyDirectoryMarketplaceReadiness(input: {
  publicationStatus: unknown;
  isActive: unknown;
  privacyBlocked: unknown;
  organizationKind: unknown;
  claimedWorkspaceId?: unknown;
  hasPublicService: unknown;
  latitude?: unknown;
  longitude?: unknown;
  scbWorkplaces?: unknown;
  scbEmail?: unknown;
  scbPhone?: unknown;
  scbConflicts?: unknown;
}): DirectoryMarketplaceReadiness {
  const reasons: string[] = [];
  const claimed = Boolean(text(input.claimedWorkspaceId));
  const conflicts = hasScbConflicts(input.scbConflicts);
  const baseEligible = text(input.publicationStatus) === "published"
    && Boolean(input.isActive)
    && !Boolean(input.privacyBlocked)
    && text(input.organizationKind) === "juridical_person"
    && Boolean(input.hasPublicService)
    && !conflicts;
  const eligible = baseEligible && !claimed;

  if (text(input.publicationStatus) !== "published") reasons.push("not_published");
  if (!Boolean(input.isActive)) reasons.push("inactive");
  if (Boolean(input.privacyBlocked)) reasons.push("privacy_blocked");
  if (text(input.organizationKind) !== "juridical_person") reasons.push("not_juridical_person");
  if (!Boolean(input.hasPublicService)) reasons.push("no_public_service");
  if (conflicts) reasons.push("scb_conflict");
  if (claimed) reasons.push("claimed_workspace_route");

  const address = selectDirectoryMarketplaceWorkplaceAddress(input.scbWorkplaces);
  const latitude = finiteCoordinate(input.latitude, -90, 90);
  const longitude = finiteCoordinate(input.longitude, -180, 180);
  const hasCoordinates = latitude !== null && longitude !== null && !(latitude === 0 && longitude === 0);
  const businessEmail = safeBusinessEmail(input.scbEmail, input.scbConflicts);
  const phone = safePhone(input.scbPhone, input.scbConflicts);
  const hasReachableContact = Boolean(businessEmail || phone);

  if (eligible && !address && !hasCoordinates) reasons.push("missing_workplace_address");
  if (eligible && !hasCoordinates && address) reasons.push("needs_geocoding");
  if (eligible && !hasReachableContact) reasons.push("needs_contact");
  if (eligible && hasCoordinates && hasReachableContact) reasons.push("marketplace_ready");
  if (eligible && hasCoordinates && businessEmail) reasons.push("auto_outreach_ready");

  return {
    eligible,
    marketplaceReady: eligible && hasCoordinates && hasReachableContact,
    autoOutreachReady: eligible && hasCoordinates && Boolean(businessEmail),
    needsGeocoding: eligible && !hasCoordinates && Boolean(address),
    needsContact: eligible && !hasReachableContact,
    needsLocationSource: eligible && !hasCoordinates && !address,
    potentialAutoOutreachAfterGeocoding: eligible && !hasCoordinates && Boolean(address) && Boolean(businessEmail),
    address,
    businessEmail,
    phone,
    hasCoordinates,
    reasons,
  };
}

export async function getCompanyDirectoryMarketplaceReadinessReport(): Promise<DirectoryMarketplaceReadinessReport> {
  const sql = getSql();
  if (!sql) {
    return {
      generatedAt: new Date().toISOString(),
      publishedActive: 0,
      guestEligible: 0,
      withUsableWorkplaceAddress: 0,
      withReachableContact: 0,
      withBusinessEmail: 0,
      withPhone: 0,
      geocoded: 0,
      marketplaceReady: 0,
      autoOutreachReady: 0,
      needsGeocoding: 0,
      needsContact: 0,
      needsLocationSource: 0,
      potentialAutoOutreachAfterGeocoding: 0,
      rows: [],
    };
  }

  const rows = await sql`
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
      location.latitude::float8 as latitude,
      location.longitude::float8 as longitude,
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
     and location.is_public = true
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.publication_status = 'published'
      and profile.is_active = true
    order by profile.display_name asc, profile.id asc
  `;

  const classified = (rows as Record<string, unknown>[]).map((row): DirectoryMarketplaceReadinessRow => {
    const readiness = classifyDirectoryMarketplaceReadiness({
      publicationStatus: row.publication_status,
      isActive: row.is_active,
      privacyBlocked: row.privacy_blocked,
      organizationKind: row.organization_kind,
      claimedWorkspaceId: row.claimed_workspace_id,
      hasPublicService: row.has_public_service,
      latitude: row.latitude,
      longitude: row.longitude,
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

  const guestRows = classified.filter((row) => row.eligible);
  const priorityRows = [...guestRows].sort((left, right) => {
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

  return {
    generatedAt: new Date().toISOString(),
    publishedActive: classified.length,
    guestEligible: guestRows.length,
    withUsableWorkplaceAddress: guestRows.filter((row) => Boolean(row.address)).length,
    withReachableContact: guestRows.filter((row) => Boolean(row.businessEmail || row.phone)).length,
    withBusinessEmail: guestRows.filter((row) => Boolean(row.businessEmail)).length,
    withPhone: guestRows.filter((row) => Boolean(row.phone)).length,
    geocoded: guestRows.filter((row) => row.hasCoordinates).length,
    marketplaceReady: guestRows.filter((row) => row.marketplaceReady).length,
    autoOutreachReady: guestRows.filter((row) => row.autoOutreachReady).length,
    needsGeocoding: guestRows.filter((row) => row.needsGeocoding).length,
    needsContact: guestRows.filter((row) => row.needsContact).length,
    needsLocationSource: guestRows.filter((row) => row.needsLocationSource).length,
    potentialAutoOutreachAfterGeocoding: guestRows.filter((row) => row.potentialAutoOutreachAfterGeocoding).length,
    rows: priorityRows.slice(0, 150),
  };
}
