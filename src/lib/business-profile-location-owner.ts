import "server-only";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
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

export function normalizeBusinessProfileLocationWrite(input: WriteBusinessProfileLocationInput) {
  if (!editableBusinessProfileLocationPurposes.includes(input.purpose)) {
    throw new Error("Only workplace, storefront or service-base locations can be owner/admin edited");
  }
  if (!businessProfileLocationVisibilities.includes(input.visibility)) {
    throw new Error("Invalid Business Profile location visibility");
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
    isVisitable: Boolean(input.isVisitable),
    isPrimary: Boolean(input.isPrimary),
    confirmed: Boolean(input.confirmed),
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

  const clearPreviousPrimary = normalized.id
    ? sql`
        update company_directory_profile_locations location
        set is_primary = false, updated_at = now()
        from company_directory_profiles profile
        where ${normalized.isPrimary} = true
          and profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and location.profile_id = profile.id
          and location.id <> ${normalized.id}::uuid
          and location.is_primary = true
          and location.is_active = true
          and exists (
            select 1
            from company_directory_profile_locations target
            where target.id = ${normalized.id}::uuid
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
        where ${normalized.isPrimary} = true
          and profile.claimed_workspace_id = ${access.workspaceId}::uuid
          and profile.publication_status = 'claimed'
          and profile.is_active = true
          and profile.privacy_blocked = false
          and location.profile_id = profile.id
          and location.is_primary = true
          and location.is_active = true
      `;

  const writeLocation = normalized.id
    ? sql`
        update company_directory_profile_locations location
        set purpose = ${normalized.purpose},
            visibility = ${normalized.visibility},
            is_visitable = ${normalized.isVisitable},
            is_primary = ${normalized.isPrimary},
            owner_workspace_id = ${access.workspaceId}::uuid,
            address_line1 = ${normalized.addressLine1},
            postal_code = ${normalized.postalCode},
            city = ${normalized.city},
            municipality = ${normalized.municipality},
            latitude = ${normalized.latitude},
            longitude = ${normalized.longitude},
            geocode_source = ${normalized.geocodeSource},
            geocode_precision = ${normalized.geocodePrecision},
            confirmed_at = case when ${normalized.confirmed} then coalesce(location.confirmed_at, now()) else null end,
            updated_at = now()
        from company_directory_profiles profile
        where location.id = ${normalized.id}::uuid
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
          profile.id, ${access.workspaceId}::uuid, ${normalized.purpose}, ${normalized.visibility},
          ${normalized.isVisitable}, ${normalized.isPrimary}, 'owner', ${normalized.addressLine1},
          ${normalized.postalCode}, ${normalized.city}, ${normalized.municipality},
          ${normalized.latitude}, ${normalized.longitude}, ${normalized.geocodeSource},
          ${normalized.geocodePrecision}, case when ${normalized.confirmed} then now() else null end
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
  return { id };
}

export async function createOwnerBusinessProfileLocation(input: WriteBusinessProfileLocationInput) {
  if (input.id) throw new Error("A new Business Profile location must not include an id");
  return writeOwnerBusinessProfileLocation(input);
}

export async function updateOwnerBusinessProfileLocation(input: WriteBusinessProfileLocationInput & { id: string }) {
  return writeOwnerBusinessProfileLocation(input);
}

export async function deactivateOwnerBusinessProfileLocation(locationId: string) {
  const access = await requireLocationManagingWorkspace();
  const id = normalizeUuid(locationId, "Business Profile location id");
  if (!id) throw new Error("Business Profile location id is required");
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
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
  if (!rows[0]?.id) throw new Error("Business Profile location is not editable by the active Workspace");
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
