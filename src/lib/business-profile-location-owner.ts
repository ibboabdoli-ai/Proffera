import "server-only";

import { getSql } from "@/lib/db/server";
import {
  CUSTOMER_ADDRESS_VERIFICATION_SOURCE,
  verifyCustomerAddress,
} from "@/lib/lantmateriet-address-verification";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { invalidatePublicDirectoryPublicProjectionByProfileId } from "@/lib/company-directory-public-cache";
import { invalidateMarketplaceHomeCompaniesCache } from "@/lib/public-read-cache";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const editableBusinessProfileLocationPurposes = [
  "workplace",
  "storefront",
  "service_base",
] as const;
export const businessProfileLocationVisibilities = ["private", "approximate", "public"] as const;
export const businessProfileLocationGeocodePrecisions = [
  "unknown",
  "postal_code",
  "street",
  "address",
  "rooftop",
] as const;

export type EditableBusinessProfileLocationPurpose = (typeof editableBusinessProfileLocationPurposes)[number];
export type BusinessProfileLocationVisibility = (typeof businessProfileLocationVisibilities)[number];
export type BusinessProfileLocationGeocodePrecision = (typeof businessProfileLocationGeocodePrecisions)[number];

export type WriteBusinessProfileLocationInput = {
  id?: string;
  purpose: EditableBusinessProfileLocationPurpose;
  visibility: BusinessProfileLocationVisibility;
  isVisitable: boolean;
  isPrimary: boolean;
  confirmed: boolean;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  municipality?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geocodeSource?: string;
  geocodePrecision?: BusinessProfileLocationGeocodePrecision;
};

export type EstablishPreReleaseSoleTraderServiceBaseInput = {
  addressLine1: string;
  postalCode: string;
  city: string;
};

export type DashboardBusinessProfileLocation = {
  id: string;
  profileId: string;
  purpose: string;
  visibility: BusinessProfileLocationVisibility;
  isVisitable: boolean;
  isPrimary: boolean;
  sourceType: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  geocodeSource: string;
  geocodePrecision: string;
  confirmedAt: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SqlClient = NonNullable<ReturnType<typeof getSql>>;
type NormalizedBusinessProfileLocationWrite = ReturnType<typeof normalizeBusinessProfileLocationWrite>;

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeUuid(value: unknown, label: string) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  if (!uuidPattern.test(candidate)) throw new Error(`Invalid ${label}`);
  return candidate;
}

function optionalCoordinate(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} is outside the allowed coordinate range`);
  }
  return parsed;
}

function storedCoordinate(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalizeBusinessProfileLocationWrite(input: WriteBusinessProfileLocationInput) {
  if (!editableBusinessProfileLocationPurposes.includes(input.purpose)) {
    throw new Error("Only workplace, storefront or service-base locations can be owner/admin edited");
  }
  if (!businessProfileLocationVisibilities.includes(input.visibility)) {
    throw new Error("Invalid Business Profile location visibility");
  }
  if (
    typeof input.isVisitable !== "boolean"
    || typeof input.isPrimary !== "boolean"
    || typeof input.confirmed !== "boolean"
  ) {
    throw new Error("Business Profile location state flags must be booleans");
  }

  const geocodePrecision = input.geocodePrecision ?? "unknown";
  if (!businessProfileLocationGeocodePrecisions.includes(geocodePrecision)) {
    throw new Error("Invalid Business Profile location geocode precision");
  }

  const latitude = optionalCoordinate(input.latitude, -90, 90, "Latitude");
  const longitude = optionalCoordinate(input.longitude, -180, 180, "Longitude");
  if ((latitude === null) !== (longitude === null)) {
    throw new Error("Latitude and longitude must be provided together");
  }
  if (input.visibility === "public" && (!input.isVisitable || !input.confirmed)) {
    throw new Error("Public Business Profile locations must be visitable and explicitly confirmed");
  }

  return {
    id: normalizeUuid(input.id, "Business Profile location id"),
    purpose: input.purpose,
    visibility: input.visibility,
    isVisitable: input.isVisitable,
    isPrimary: input.isPrimary,
    confirmed: input.confirmed,
    addressLine1: cleanText(input.addressLine1, 250),
    postalCode: cleanText(input.postalCode, 32),
    city: cleanText(input.city, 120),
    municipality: cleanText(input.municipality, 120),
    latitude,
    longitude,
    geocodeSource: cleanText(input.geocodeSource, 80),
    geocodePrecision,
  };
}

function rowToLocation(row: Record<string, unknown>): DashboardBusinessProfileLocation {
  const coordinate = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const candidateVisibility = String(row.visibility ?? "");
  const visibility = businessProfileLocationVisibilities.includes(
    candidateVisibility as BusinessProfileLocationVisibility,
  )
    ? candidateVisibility as BusinessProfileLocationVisibility
    : "private";

  return {
    id: String(row.id ?? ""),
    profileId: String(row.profile_id ?? ""),
    purpose: String(row.purpose ?? ""),
    visibility,
    isVisitable: Boolean(row.is_visitable),
    isPrimary: Boolean(row.is_primary),
    sourceType: String(row.source_type ?? ""),
    addressLine1: String(row.address_line1 ?? ""),
    postalCode: String(row.postal_code ?? ""),
    city: String(row.city ?? ""),
    municipality: String(row.municipality ?? ""),
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    geocodeSource: String(row.geocode_source ?? ""),
    geocodePrecision: String(row.geocode_precision ?? "unknown"),
    confirmedAt: row.confirmed_at ? new Date(String(row.confirmed_at)).toISOString() : "",
  };
}

async function requireLocationManagingWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("Workspace owner or admin access is required to manage Business Profile locations");
  }
  return access;
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
}

function sameNormalizedAddress(
  normalized: NormalizedBusinessProfileLocationWrite,
  row: Record<string, unknown>,
) {
  return normalized.addressLine1 === cleanText(row.address_line1, 250)
    && normalized.postalCode === cleanText(row.postal_code, 32)
    && normalized.city === cleanText(row.city, 120)
    && normalized.municipality === cleanText(row.municipality, 120);
}

async function authorizeConfirmedServiceBaseWrite(
  sql: SqlClient,
  workspaceId: string,
  normalized: NormalizedBusinessProfileLocationWrite,
) {
  if (normalized.id) {
    const rows = await sql`
      select
        profile.id::text as profile_id,
        location.address_line1,
        location.postal_code,
        location.city,
        location.municipality,
        location.latitude::float8,
        location.longitude::float8,
        location.geocode_source,
        location.geocode_precision,
        location.confirmed_at::text as confirmed_at
      from company_directory_profiles profile
      join company_directory_profile_locations location
        on location.profile_id = profile.id
       and location.id = ${normalized.id}::uuid
       and location.source_type = 'owner'
       and location.owner_workspace_id = ${workspaceId}::uuid
       and location.is_active = true
      where profile.claimed_workspace_id = ${workspaceId}::uuid
        and profile.publication_status = 'claimed'
        and profile.is_active = true
        and profile.privacy_blocked = false
      limit 1
    `;
    if (!rows[0]?.profile_id) {
      throw new Error("Business Profile location is not owned by the currently claimed Workspace");
    }
    return rows[0] as Record<string, unknown>;
  }

  const rows = await sql`
    select profile.id::text as profile_id
    from company_directory_profiles profile
    where profile.claimed_workspace_id = ${workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
    limit 1
  `;
  if (!rows[0]?.profile_id) {
    throw new Error("The active Workspace does not own an eligible claimed Business Profile");
  }
  return rows[0] as Record<string, unknown>;
}

async function authoritativeOwnerLocationWrite(
  sql: SqlClient,
  workspaceId: string,
  normalized: NormalizedBusinessProfileLocationWrite,
): Promise<NormalizedBusinessProfileLocationWrite> {
  if (normalized.purpose !== "service_base") return normalized;

  if (!normalized.confirmed) {
    return {
      ...normalized,
      latitude: null,
      longitude: null,
      geocodeSource: "",
      geocodePrecision: "unknown",
    };
  }

  if (!normalized.addressLine1 || !normalized.postalCode || !normalized.city) {
    throw new Error("Confirmed service base requires a complete address");
  }

  const authority = await authorizeConfirmedServiceBaseWrite(sql, workspaceId, normalized);
  if (normalized.id && sameNormalizedAddress(normalized, authority)) {
    const latitude = storedCoordinate(authority.latitude, -90, 90);
    const longitude = storedCoordinate(authority.longitude, -180, 180);
    if (
      latitude !== null
      && longitude !== null
      && !(latitude === 0 && longitude === 0)
      && cleanText(authority.geocode_source, 80) === CUSTOMER_ADDRESS_VERIFICATION_SOURCE
      && cleanText(authority.geocode_precision, 32) === "address"
      && Boolean(authority.confirmed_at)
    ) {
      return {
        ...normalized,
        latitude,
        longitude,
        geocodeSource: CUSTOMER_ADDRESS_VERIFICATION_SOURCE,
        geocodePrecision: "address",
      };
    }
  }

  const verified = await verifyCustomerAddress({
    addressLine1: normalized.addressLine1,
    postalCode: normalized.postalCode,
    city: normalized.city,
  });
  if (verified.status !== "matched") {
    throw new Error(`Service base address verification failed: ${verified.status}:${verified.reason}`);
  }

  const transformedRows = await sql`
    select
      st_y(transformed.point)::float8 as latitude,
      st_x(transformed.point)::float8 as longitude
    from (
      select st_transform(
        st_setsrid(st_makepoint(${verified.easting}::float8, ${verified.northing}::float8), 3006),
        4326
      ) as point
    ) transformed
  `;
  const latitude = storedCoordinate(transformedRows[0]?.latitude, -90, 90);
  const longitude = storedCoordinate(transformedRows[0]?.longitude, -180, 180);
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) {
    throw new Error("Service base address verification returned invalid coordinates");
  }

  return {
    ...normalized,
    latitude,
    longitude,
    geocodeSource: verified.source,
    geocodePrecision: "address",
  };
}

export async function listOwnerBusinessProfileLocations(): Promise<DashboardBusinessProfileLocation[]> {
  const access = await requireLocationManagingWorkspace();
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    select
      location.id::text, location.profile_id::text, location.purpose, location.visibility,
      location.is_visitable, location.is_primary, location.source_type,
      location.address_line1, location.postal_code, location.city, location.municipality,
      location.latitude::float8, location.longitude::float8,
      location.geocode_source, location.geocode_precision, location.confirmed_at
    from company_directory_profiles profile
    join company_directory_profile_locations location
      on location.profile_id = profile.id
     and location.is_active = true
    where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and (location.source_type <> 'owner' or location.owner_workspace_id = ${access.workspaceId}::uuid)
    order by location.is_primary desc, location.purpose, location.created_at, location.id
  `;
  return rows.map((row) => rowToLocation(row));
}

async function writeOwnerBusinessProfileLocation(input: WriteBusinessProfileLocationInput) {
  const access = await requireLocationManagingWorkspace();
  const normalized = normalizeBusinessProfileLocationWrite(input);
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const authoritative = await authoritativeOwnerLocationWrite(sql, access.workspaceId, normalized);

  const lockProfile = sql`
    select profile.id
    from company_directory_profiles profile
    where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
    limit 1
    for update
  `;

  const clearPreviousPrimary = authoritative.id
    ? sql`
        update company_directory_profile_locations location
        set is_primary = false, updated_at = now()
        from company_directory_profiles profile
        where ${authoritative.isPrimary} = true
          and profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and location.profile_id = profile.id
          and location.id <> ${authoritative.id}::uuid
          and location.is_primary = true
          and location.is_active = true
          and exists (
            select 1
            from company_directory_profile_locations target
            where target.id = ${authoritative.id}::uuid
              and target.profile_id = profile.id
              and target.source_type = 'owner'
              and target.owner_workspace_id = ${access.workspaceId}::uuid
              and target.is_active = true
          )
      `
    : sql`
        update company_directory_profile_locations location
        set is_primary = false, updated_at = now()
        from company_directory_profiles profile
        where ${authoritative.isPrimary} = true
          and profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and location.profile_id = profile.id
          and location.is_primary = true
          and location.is_active = true
      `;

  const writeLocation = authoritative.id
    ? sql`
        update company_directory_profile_locations location
        set purpose = ${authoritative.purpose},
            visibility = ${authoritative.visibility},
            is_visitable = ${authoritative.isVisitable},
            is_primary = ${authoritative.isPrimary},
            owner_workspace_id = ${access.workspaceId}::uuid,
            address_line1 = ${authoritative.addressLine1},
            postal_code = ${authoritative.postalCode},
            city = ${authoritative.city},
            municipality = ${authoritative.municipality},
            latitude = ${authoritative.latitude},
            longitude = ${authoritative.longitude},
            geocode_source = ${authoritative.geocodeSource},
            geocode_precision = ${authoritative.geocodePrecision},
            confirmed_at = case when ${authoritative.confirmed} then coalesce(location.confirmed_at, now()) else null end,
            updated_at = now()
        from company_directory_profiles profile
        where location.id = ${authoritative.id}::uuid
          and location.profile_id = profile.id
          and location.source_type = 'owner'
          and location.owner_workspace_id = ${access.workspaceId}::uuid
          and location.is_active = true
          and profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
        returning location.id::text
      `
    : sql`
        insert into company_directory_profile_locations (
          profile_id, owner_workspace_id, purpose, visibility, is_visitable, is_primary,
          source_type, address_line1, postal_code, city, municipality,
          latitude, longitude, geocode_source, geocode_precision, confirmed_at
        )
        select
          profile.id, ${access.workspaceId}::uuid, ${authoritative.purpose}, ${authoritative.visibility},
          ${authoritative.isVisitable}, ${authoritative.isPrimary}, 'owner', ${authoritative.addressLine1},
          ${authoritative.postalCode}, ${authoritative.city}, ${authoritative.municipality},
          ${authoritative.latitude}, ${authoritative.longitude}, ${authoritative.geocodeSource},
          ${authoritative.geocodePrecision}, case when ${authoritative.confirmed} then now() else null end
        from company_directory_profiles profile
        where profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
        limit 1
        returning id::text
      `;

  const [profileRows, , writeRows] = await sql.transaction([
    lockProfile,
    clearPreviousPrimary,
    writeLocation,
  ]);

  if (!profileRows?.[0]?.id) {
    throw new Error("The active Workspace does not own an eligible claimed Business Profile");
  }
  const id = String(writeRows?.[0]?.id ?? "");
  if (!id) {
    throw new Error("Business Profile location is not owned by the currently claimed Workspace");
  }
  const profileId = String(profileRows[0]?.id ?? "");

  try {
    await invalidatePublicDirectoryPublicProjectionByProfileId(profileId);
  } catch (error) {
    console.error("Failed to invalidate public Directory cache after committed owner-location mutation", {
      profileId,
      locationId: id,
      error,
    });
  }

  try {
    invalidateMarketplaceHomeCompaniesCache();
  } catch (error) {
    console.error("Failed to invalidate Marketplace cache after committed owner-location mutation", {
      locationId: id,
      error,
    });
  }

  return { id };
}

export async function createOwnerBusinessProfileLocation(input: WriteBusinessProfileLocationInput) {
  if (input.id) throw new Error("A new Business Profile location must not include an id");
  return writeOwnerBusinessProfileLocation(input);
}

export async function establishPreReleaseSoleTraderServiceBase(
  input: EstablishPreReleaseSoleTraderServiceBaseInput,
) {
  const access = await requireLocationManagingWorkspace();
  const normalized = normalizeBusinessProfileLocationWrite({
    purpose: "service_base",
    visibility: "private",
    isVisitable: true,
    isPrimary: true,
    confirmed: true,
    addressLine1: input.addressLine1,
    postalCode: input.postalCode,
    city: input.city,
    municipality: "",
  });
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const authority = await sql`
    select profile.id::text as profile_id
    from company_directory_profiles profile
    where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.organization_kind = 'sole_trader'
      and profile.organization_number ~ '^sole-trader-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and profile.publication_status = 'blocked'
      and profile.is_active = true
      and profile.privacy_blocked = true
      and profile.auto_public_eligible = false
      and profile.published_at is null
      and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
      and coalesce(trim(profile.display_name), '') <> ''
      and coalesce(trim(profile.legal_form), '') <> ''
      and profile.organization_status = 'Registrerad'
      and coalesce(trim(profile.address_line1), '') = ''
      and coalesce(trim(profile.postal_code), '') = ''
      and exists (
        select 1
        from company_directory_claims owner_claim
        where owner_claim.profile_id = profile.id
          and owner_claim.requested_workspace_id = ${access.workspaceId}::uuid
          and owner_claim.status = 'claimed'
          and owner_claim.verification_method = 'manual_review'
      )
    limit 1
  `;
  if (!authority[0]?.profile_id) {
    throw new Error("The active Workspace does not own an eligible blocked sole-trader profile");
  }

  const verified = await verifyCustomerAddress({
    addressLine1: normalized.addressLine1,
    postalCode: normalized.postalCode,
    city: normalized.city,
  });
  if (verified.status !== "matched") {
    throw new Error(`Service base address verification failed: ${verified.status}:${verified.reason}`);
  }
  const transformedRows = await sql`
    select
      st_y(transformed.point)::float8 as latitude,
      st_x(transformed.point)::float8 as longitude
    from (
      select st_transform(
        st_setsrid(st_makepoint(${verified.easting}::float8, ${verified.northing}::float8), 3006),
        4326
      ) as point
    ) transformed
  `;
  const latitude = storedCoordinate(transformedRows[0]?.latitude, -90, 90);
  const longitude = storedCoordinate(transformedRows[0]?.longitude, -180, 180);
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) {
    throw new Error("Service base address verification returned invalid coordinates");
  }

  const rows = await sql`
    with profile_guard as (
      select profile.id
      from company_directory_profiles profile
      where profile.id = ${String(authority[0].profile_id)}::uuid
        and profile.claimed_workspace_id = ${access.workspaceId}::uuid
        and profile.organization_kind = 'sole_trader'
        and profile.publication_status = 'blocked'
        and profile.is_active = true
        and profile.privacy_blocked = true
        and profile.auto_public_eligible = false
        and profile.published_at is null
        and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
        and coalesce(trim(profile.display_name), '') <> ''
        and coalesce(trim(profile.legal_form), '') <> ''
        and profile.organization_status = 'Registrerad'
        and coalesce(trim(profile.address_line1), '') = ''
        and coalesce(trim(profile.postal_code), '') = ''
        and exists (
          select 1 from company_directory_claims owner_claim
          where owner_claim.profile_id = profile.id
            and owner_claim.requested_workspace_id = ${access.workspaceId}::uuid
            and owner_claim.status = 'claimed'
            and owner_claim.verification_method = 'manual_review'
        )
      for update
    ), cleared_primary as (
      update company_directory_profile_locations location
      set is_primary = false, updated_at = now()
      where location.profile_id = (select id from profile_guard)
        and location.is_primary = true
        and location.is_active = true
        and not (
          location.source_type = 'owner'
          and location.owner_workspace_id = ${access.workspaceId}::uuid
          and location.purpose = 'service_base'
        )
      returning location.id
    ), updated_location as (
      update company_directory_profile_locations location
      set visibility = 'private', is_visitable = true, is_primary = true, is_active = true,
          address_line1 = ${normalized.addressLine1}, postal_code = ${normalized.postalCode},
          city = ${normalized.city}, municipality = '', latitude = ${latitude}, longitude = ${longitude},
          geocode_source = ${verified.source}, geocode_precision = 'address',
          confirmed_at = now(), updated_at = now()
      where location.profile_id = (select id from profile_guard)
        and location.source_type = 'owner'
        and location.owner_workspace_id = ${access.workspaceId}::uuid
        and location.purpose = 'service_base'
        and location.is_active = true
      returning location.id::text
    ), inserted_location as (
      insert into company_directory_profile_locations (
        profile_id, owner_workspace_id, purpose, visibility, is_visitable, is_primary,
        is_active, source_type, address_line1, postal_code, city, municipality,
        latitude, longitude, geocode_source, geocode_precision, confirmed_at
      )
      select id, ${access.workspaceId}::uuid, 'service_base', 'private', true, true,
        true, 'owner', ${normalized.addressLine1}, ${normalized.postalCode}, ${normalized.city}, '',
        ${latitude}, ${longitude}, ${verified.source}, 'address', now()
      from profile_guard
      where not exists (select 1 from updated_location)
      returning id::text
    )
    select id from updated_location
    union all
    select id from inserted_location
    limit 1
  `;
  const id = String(rows[0]?.id ?? "");
  if (!id) throw new Error("The blocked sole-trader profile changed before its service base was stored");
  return { id };
}

export async function updateOwnerBusinessProfileLocation(input: WriteBusinessProfileLocationInput & { id: string }) {
  const id = normalizeUuid(input.id, "Business Profile location id");
  if (!id) throw new Error("Business Profile location id is required");
  return writeOwnerBusinessProfileLocation({ ...input, id });
}

export async function deactivateOwnerBusinessProfileLocation(locationId: string) {
  const access = await requireLocationManagingWorkspace();
  const id = normalizeUuid(locationId, "Business Profile location id");
  if (!id) throw new Error("Business Profile location id is required");
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const lockProfile = sql`
    select profile.id
    from company_directory_profiles profile
    where profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
    limit 1
    for update
  `;
  const deactivateLocation = sql`
    update company_directory_profile_locations location
    set is_active = false, is_primary = false, visibility = 'private', updated_at = now()
    from company_directory_profiles profile
    where location.id = ${id}::uuid
      and location.profile_id = profile.id
      and location.source_type = 'owner'
      and location.owner_workspace_id = ${access.workspaceId}::uuid
      and profile.claimed_workspace_id = ${access.workspaceId}::uuid
      and profile.publication_status = 'claimed'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and location.is_active = true
    returning location.id::text
  `;

  const [profileRows, rows] = await sql.transaction([lockProfile, deactivateLocation]);
  if (!profileRows?.[0]?.id) {
    throw new Error("The active Workspace does not own an eligible claimed Business Profile");
  }
  if (!rows?.[0]?.id) throw new Error("Business Profile location is not editable by the active Workspace");
  const profileId = String(profileRows[0]?.id ?? "");

  try {
    await invalidatePublicDirectoryPublicProjectionByProfileId(profileId);
  } catch (error) {
    console.error("Failed to invalidate public Directory cache after committed owner-location deactivation", {
      profileId,
      locationId: id,
      error,
    });
  }

  try {
    invalidateMarketplaceHomeCompaniesCache();
  } catch (error) {
    console.error("Failed to invalidate Marketplace cache after committed owner-location deactivation", {
      locationId: id,
      error,
    });
  }
}

export async function listAdminBusinessProfileLocations(profileId: string): Promise<DashboardBusinessProfileLocation[]> {
  await requireSuperAdmin();
  const normalizedProfileId = normalizeUuid(profileId, "Business Profile id");
  if (!normalizedProfileId) throw new Error("Business Profile id is required");
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    select
      id::text, profile_id::text, purpose, visibility, is_visitable, is_primary, source_type,
      address_line1, postal_code, city, municipality, latitude::float8, longitude::float8,
      geocode_source, geocode_precision, confirmed_at
    from company_directory_profile_locations
    where profile_id = ${normalizedProfileId}::uuid
      and is_active = true
    order by is_primary desc, purpose, created_at, id
  `;
  return rows.map((row) => rowToLocation(row));
}
