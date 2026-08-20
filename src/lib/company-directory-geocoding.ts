import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

const DEFAULT_LANTMATERIET_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
const GEOCODE_SOURCE = "lantmateriet_belagenhetsadress_v4_2";
const NO_MATCH_SOURCE = "lantmateriet_no_match_v4_2";
const MAX_DETAIL_FALLBACK_CANDIDATES = 5;

export const DIRECTORY_GEOCODING_PILOT_ORGS = [
  "5563115707",
  "5563276806",
  "5562659226",
  "5565851911",
  "5565228128",
  "5565120846",
  "5565046066",
  "5560622028",
  "5563890887",
  "5564255841",
  "5564414786",
  "5565420451",
  "5565634721",
  "5565521902",
  "5564090230",
  "5563857449",
  "5564362696",
  "5563852622",
  "5565298444",
  "5564212503",
  "5565306239",
  "5562977271",
  "5562149939",
  "5562039429",
  "5563388478",
  "5564208337",
] as const;

type AddressComponents = {
  postnummer?: number | string | null;
  postort?: string | null;
};

export type LantmaterietAddressReference = {
  objektidentitet?: string;
  adress?: string;
  adressComponents?: AddressComponents;
};

type PilotProfile = {
  id: string;
  organizationNumber: string;
  companyName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
};

export type DirectoryGeocodingBatchResult = {
  attempted: number;
  geocoded: number;
  noMatch: number;
  errors: number;
  remaining: number;
  needsReview: number;
};

export type DirectoryGeocodingStatus = {
  enabled: boolean;
  configured: boolean;
  postgisReady: boolean;
  pilotTotal: number;
  geocoded: number;
  remaining: number;
  needsReview: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePostcode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isUuid(value: unknown) {
  return /^[0-9a-f-]{36}$/i.test(String(value ?? ""));
}

export function cleanDirectoryStreetAddress(value: unknown) {
  let address = String(value ?? "").trim().replace(/\s+/g, " ");
  address = address.replace(/\s*,\s*(?:bv|nb|\d+\s*tr)\s*$/i, "");
  address = address.replace(/\s+(?:bv|nb)\s*$/i, "");
  address = address.replace(/\s+(?:lgh|läg(?:enhet)?\s*nr)\s*\d{4}\s*$/i, "");
  address = address.replace(/\s*,\s*\d{4}\s*$/i, "");
  return address.trim();
}

export function buildDirectoryAddressSearchText(streetAddress: unknown, city: unknown) {
  return [cleanDirectoryStreetAddress(streetAddress), String(city ?? "").trim()]
    .filter(Boolean)
    .join(", ");
}

export function selectUniqueDirectoryAddressReference(
  references: LantmaterietAddressReference[],
  postalCode: unknown,
  city: unknown,
) {
  const expectedPostcode = normalizePostcode(postalCode);
  const expectedCity = normalizeText(city);
  const matches = references.filter((reference) => {
    const components = reference.adressComponents;
    if (!components) return false;
    return normalizePostcode(components.postnummer) === expectedPostcode
      && normalizeText(components.postort) === expectedCity
      && isUuid(reference.objektidentitet);
  });
  return matches.length === 1 ? matches[0] : null;
}

export function selectDirectoryAddressReferenceCandidates(
  references: LantmaterietAddressReference[],
  postalCode: unknown,
  city: unknown,
) {
  const expectedPostcode = normalizePostcode(postalCode);
  const expectedCity = normalizeText(city);
  if (!expectedPostcode || !expectedCity) return [];

  const valid = references.filter((reference) => isUuid(reference.objektidentitet));
  const exact = valid.filter((reference) => {
    const components = reference.adressComponents;
    return normalizePostcode(components?.postnummer) === expectedPostcode
      && normalizeText(components?.postort) === expectedCity;
  });

  if (exact.length === 1) return exact;
  if (exact.length > 1) return [];

  return valid.filter((reference) => {
    const referencePostcode = normalizePostcode(reference.adressComponents?.postnummer);
    const referenceCity = normalizeText(reference.adressComponents?.postort);
    const postcodeCompatible = !referencePostcode || referencePostcode === expectedPostcode;
    const cityCompatible = !referenceCity || referenceCity === expectedCity;
    const hasMissingPostalComponent = !referencePostcode || !referenceCity;
    return postcodeCompatible && cityCompatible && hasMissingPostalComponent;
  });
}

export function parseSwerefPointGeometry(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length !== 1) return null;
  const feature = features[0];
  if (!feature || typeof feature !== "object") return null;
  const geometry = (feature as { geometry?: unknown }).geometry;
  if (!geometry || typeof geometry !== "object") return null;
  const typed = geometry as { type?: unknown; coordinates?: unknown };
  if (typed.type !== "Point" || !Array.isArray(typed.coordinates) || typed.coordinates.length < 2) return null;
  const easting = Number(typed.coordinates[0]);
  const northing = Number(typed.coordinates[1]);
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  return { easting, northing };
}

export function parseExactSwerefAddressDetail(payload: unknown, postalCode: unknown, city: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length !== 1) return null;
  const feature = features[0];
  if (!feature || typeof feature !== "object") return null;
  const properties = (feature as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return null;
  const addressAttributes = (properties as { adressplatsattribut?: unknown }).adressplatsattribut;
  if (!addressAttributes || typeof addressAttributes !== "object") return null;
  const typed = addressAttributes as AddressComponents;
  if (normalizePostcode(typed.postnummer) !== normalizePostcode(postalCode)) return null;
  if (normalizeText(typed.postort) !== normalizeText(city)) return null;
  return parseSwerefPointGeometry(payload);
}

function geocodingEnabled() {
  return process.env.COMPANY_DIRECTORY_GEOCODING_ENABLED?.trim().toLowerCase() === "true";
}

function getGeocodingConfig() {
  const enabled = geocodingEnabled();
  const username = process.env.LANTMATERIET_ADDRESS_API_USERNAME?.trim() ?? "";
  const password = process.env.LANTMATERIET_ADDRESS_API_PASSWORD?.trim() ?? "";
  const rawBase = process.env.LANTMATERIET_ADDRESS_API_BASE_URL?.trim() || DEFAULT_LANTMATERIET_BASE_URL;
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBase);
  } catch {
    baseUrl = new URL(DEFAULT_LANTMATERIET_BASE_URL);
  }
  const allowedHost = baseUrl.hostname === "api.lantmateriet.se" || baseUrl.hostname === "api-ver.lantmateriet.se";
  const allowedPath = baseUrl.pathname === "/distribution/produkter/belagenhetsadress/v4.2"
    || baseUrl.pathname === "/distribution/produkter/belagenhetsadress/v4.2/";
  return {
    enabled,
    username,
    password,
    baseUrl: allowedHost && allowedPath ? baseUrl.toString().replace(/\/$/, "") : DEFAULT_LANTMATERIET_BASE_URL,
    configured: enabled && Boolean(username) && Boolean(password) && allowedHost && allowedPath,
  };
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
}

function authorizationHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

async function fetchJson(url: URL, username: string, password: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: authorizationHeader(username, password),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Lantmäteriet request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

async function resolveOfficialAddress(profile: PilotProfile, config: ReturnType<typeof getGeocodingConfig>) {
  const streetAddress = cleanDirectoryStreetAddress(profile.addressLine1);
  if (!streetAddress || streetAddress.toLocaleLowerCase("sv-SE").startsWith("box ")) return null;

  const searchUrl = new URL(`${config.baseUrl}/referens/fritext`);
  searchUrl.searchParams.set("adress", buildDirectoryAddressSearchText(streetAddress, profile.city));
  searchUrl.searchParams.set("status", "Gällande");
  searchUrl.searchParams.set("maxHits", "20");
  searchUrl.searchParams.set("splitAdress", "true");

  const referencePayload = await fetchJson(searchUrl, config.username, config.password);
  if (!Array.isArray(referencePayload)) return null;
  const candidates = selectDirectoryAddressReferenceCandidates(
    referencePayload as LantmaterietAddressReference[],
    profile.postalCode,
    profile.city,
  );
  if (candidates.length === 0 || candidates.length > MAX_DETAIL_FALLBACK_CANDIDATES) return null;

  let resolved: { easting: number; northing: number; objectId: string } | null = null;
  for (const candidate of candidates) {
    if (!candidate.objektidentitet) continue;
    const detailUrl = new URL(`${config.baseUrl}/${encodeURIComponent(candidate.objektidentitet)}`);
    detailUrl.searchParams.set("includeData", "basinformation");
    detailUrl.searchParams.set("srid", "3006");
    const detailPayload = await fetchJson(detailUrl, config.username, config.password);
    const point = parseExactSwerefAddressDetail(detailPayload, profile.postalCode, profile.city);
    if (!point) continue;
    if (resolved) return null;
    resolved = { ...point, objectId: candidate.objektidentitet };
  }

  return resolved;
}

async function postgisReady() {
  const sql = getSql();
  if (!sql) return false;
  const rows = await sql`
    select exists(
      select 1 from pg_extension where extname = 'postgis'
    ) as ready
  `;
  return Boolean(rows[0]?.ready);
}

async function pilotCounts() {
  const sql = getSql();
  if (!sql) {
    return { geocoded: 0, remaining: DIRECTORY_GEOCODING_PILOT_ORGS.length, needsReview: 0 };
  }
  const orgsJson = JSON.stringify(DIRECTORY_GEOCODING_PILOT_ORGS);
  const rows = await sql`
    select
      count(*) filter (where location.latitude is not null and location.longitude is not null)::int as geocoded,
      count(*) filter (where location.geocode_source = ${NO_MATCH_SOURCE})::int as needs_review,
      count(*) filter (
        where (location.latitude is null or location.longitude is null)
          and coalesce(location.geocode_source, '') <> ${NO_MATCH_SOURCE}
      )::int as remaining
    from company_directory_profiles profile
    left join company_directory_business_locations location on location.profile_id = profile.id
    where profile.organization_number in (
      select jsonb_array_elements_text(${orgsJson}::jsonb)
    )
  `;
  return {
    geocoded: Number(rows[0]?.geocoded ?? 0),
    needsReview: Number(rows[0]?.needs_review ?? 0),
    remaining: Number(rows[0]?.remaining ?? DIRECTORY_GEOCODING_PILOT_ORGS.length),
  };
}

export async function getDirectoryGeocodingStatus(): Promise<DirectoryGeocodingStatus> {
  const config = getGeocodingConfig();
  const [postgis, counts] = await Promise.all([postgisReady(), pilotCounts()]);
  return {
    enabled: config.enabled,
    configured: config.configured,
    postgisReady: postgis,
    pilotTotal: DIRECTORY_GEOCODING_PILOT_ORGS.length,
    geocoded: counts.geocoded,
    remaining: counts.remaining,
    needsReview: counts.needsReview,
  };
}

async function markNoMatch(profileId: string) {
  const sql = getSql();
  if (!sql) return;
  await sql`
    insert into company_directory_business_locations (
      profile_id, geocode_source, geocode_precision, geocode_confidence,
      is_public, geocoded_at, updated_at
    ) values (
      ${profileId}::uuid, ${NO_MATCH_SOURCE}, 'unknown', 0, false, now(), now()
    )
    on conflict (profile_id) do update set
      geocode_source = excluded.geocode_source,
      geocode_precision = excluded.geocode_precision,
      geocode_confidence = excluded.geocode_confidence,
      is_public = false,
      geocoded_at = excluded.geocoded_at,
      updated_at = now()
    where company_directory_business_locations.latitude is null
       or company_directory_business_locations.longitude is null
  `;
}

export async function geocodeDirectoryPilotFromAdmin(limit = 5): Promise<DirectoryGeocodingBatchResult> {
  await requireSuperAdmin();
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const config = getGeocodingConfig();
  if (!config.configured) throw new Error("Lantmäteriet geocoding is not configured");
  if (!(await postgisReady())) throw new Error("PostGIS is not installed");

  const boundedLimit = Math.max(1, Math.min(5, Math.floor(Number(limit) || 5)));
  const orgsJson = JSON.stringify(DIRECTORY_GEOCODING_PILOT_ORGS);
  const rows = await sql`
    select
      profile.id::text,
      profile.organization_number,
      profile.display_name,
      profile.address_line1,
      profile.postal_code,
      profile.city
    from company_directory_profiles profile
    left join company_directory_business_locations location on location.profile_id = profile.id
    where profile.organization_number in (
      select jsonb_array_elements_text(${orgsJson}::jsonb)
    )
      and profile.publication_status in ('ready', 'published')
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.address_line1 <> ''
      and lower(profile.address_line1) not like 'box %'
      and lower(profile.address_line1) not like 'kivra:%'
      and (location.latitude is null or location.longitude is null)
      and coalesce(location.geocode_source, '') <> ${NO_MATCH_SOURCE}
    order by profile.category_slug, profile.display_name
    limit ${boundedLimit}
  `;

  let geocoded = 0;
  let noMatch = 0;
  let errors = 0;

  for (const row of rows) {
    const profile: PilotProfile = {
      id: String(row.id),
      organizationNumber: String(row.organization_number),
      companyName: String(row.display_name),
      addressLine1: String(row.address_line1),
      postalCode: String(row.postal_code),
      city: String(row.city),
    };
    try {
      const resolved = await resolveOfficialAddress(profile, config);
      if (!resolved) {
        await markNoMatch(profile.id);
        noMatch += 1;
        continue;
      }
      const saved = await sql`
        with transformed as (
          select ST_Transform(
            ST_SetSRID(ST_MakePoint(${resolved.easting}, ${resolved.northing}), 3006),
            4326
          ) as point
        )
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, geocode_source, geocode_precision,
          geocode_confidence, is_public, geocoded_at, updated_at
        )
        select
          ${profile.id}::uuid,
          ST_Y(point),
          ST_X(point),
          ${GEOCODE_SOURCE},
          'address',
          100,
          true,
          now(),
          now()
        from transformed
        on conflict (profile_id) do update set
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          geocode_source = excluded.geocode_source,
          geocode_precision = excluded.geocode_precision,
          geocode_confidence = excluded.geocode_confidence,
          is_public = excluded.is_public,
          geocoded_at = excluded.geocoded_at,
          updated_at = now()
        where company_directory_business_locations.latitude is null
           or company_directory_business_locations.longitude is null
        returning profile_id
      `;
      if (saved[0]) geocoded += 1;
    } catch {
      errors += 1;
    }
  }

  const counts = await pilotCounts();
  return {
    attempted: rows.length,
    geocoded,
    noMatch,
    errors,
    remaining: counts.remaining,
    needsReview: counts.needsReview,
  };
}
