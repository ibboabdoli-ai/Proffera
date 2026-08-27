import "server-only";

import {
  resolveCompanyDirectoryCanonicalWorkplaceAddress,
  type DirectoryPublicAddress,
} from "@/lib/company-directory-scb-address";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

const DEFAULT_LANTMATERIET_DETAIL_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
const DEFAULT_LANTMATERIET_LOOKUP_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/uppslag/adress/v3";
const GEOCODE_SOURCE = "lantmateriet_belagenhetsadress_v4_2";
const NO_MATCH_SOURCE = "lantmateriet_no_match_v4_2";
const SCB_WORKPLACE_NO_MATCH_SOURCE_PREFIX = `${NO_MATCH_SOURCE}:scb_workplace:`;
const REGISTER_UNIT_NO_MATCH_SOURCE_PREFIX = `${NO_MATCH_SOURCE}:registerenhet_v1:scb_workplace:`;
const MAX_DETAIL_FALLBACK_CANDIDATES = 5;
const GEOCODING_ACTION_BUDGET_MS = 240_000;
const GEOCODING_FINAL_COUNTS_RESERVE_MS = 10_000;
const UPSTREAM_REQUEST_TIMEOUT_MS = 12_000;
const FETCH_DEADLINE_GUARD_MS = 1_000;

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

export const DIRECTORY_GEOCODING_DIAGNOSTIC_RETRY_ORGS = [
  "5564208337", // Flottbrovägen 4
  "5563276806", // Segelbåtsvägen 7
  "5565120846", // Narvavägen 23A
] as const;

export type DirectoryGeocodingNoMatchReason =
  | "invalid_address"
  | "unexpected_reference_response"
  | "no_reference"
  | "invalid_reference"
  | "reference_postal_mismatch"
  | "too_many_candidates"
  | "unexpected_detail_response"
  | "postal_mismatch"
  | "street_mismatch"
  | "missing_point"
  | "ambiguous_exact_match"
  | "no_exact_detail_match";

type AddressComponents = {
  postnummer?: number | string | null;
  postort?: string | null;
};

type AddressPlaceDesignation = {
  adressplatsnummer?: number | string | null;
  bokstavstillagg?: string | null;
  lagestillagg?: string | null;
  lagestillaggsnummer?: number | string | null;
  avvikandeAdressplatsbeteckning?: string | null;
};

type RegisterUnitReference = {
  objektidentitet?: string | null;
};

type AddressDetailProperties = {
  objektidentitet?: string | null;
  registerenhetsreferens?: RegisterUnitReference | RegisterUnitReference[] | null;
  adressplatsattribut?: AddressComponents & {
    adressplatsbeteckning?: AddressPlaceDesignation;
  };
  adressomrade?: {
    faststalltNamn?: string | null;
  };
  gardsadressomrade?: {
    faststalltNamn?: string | null;
  } | null;
};

export type LantmaterietAddressReference = {
  objektidentitet?: string;
  adress?: string | (AddressComponents & Record<string, unknown>);
  adressComponents?: AddressComponents;
};

type DirectoryGeocodingAddressSource = "profile" | "scb_workplace";

type DirectoryGeocodingAddressSelection = {
  address: DirectoryPublicAddress;
  source: DirectoryGeocodingAddressSource;
};

type PilotProfile = {
  id: string;
  organizationNumber: string;
  companyName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  addressSource: DirectoryGeocodingAddressSource;
};

type SwerefPoint = {
  easting: number;
  northing: number;
};

type AddressDetailDiagnostic =
  | { point: SwerefPoint; reason: null }
  | { point: null; reason: DirectoryGeocodingNoMatchReason };

type RegisterUnitAddressDiagnostic =
  | { point: SwerefPoint; addressId: string; reason: null }
  | { point: null; addressId: null; reason: DirectoryGeocodingNoMatchReason };

type OfficialAddressResolution =
  | { status: "matched"; easting: number; northing: number; objectId: string }
  | { status: "no_match"; reason: DirectoryGeocodingNoMatchReason };

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

class GeocodingDeadlineExceeded extends Error {
  constructor() {
    super("Company Directory geocoding action deadline reached");
    this.name = "GeocodingDeadlineExceeded";
  }
}

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

function normalizeStreetAddress(value: unknown) {
  return normalizeText(cleanDirectoryStreetAddress(value))
    .replace(/(\d)\s+([a-z])\b/g, "$1$2");
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasScbConflicts(value: unknown) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "string") return true;
  if (!value.trim()) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return !Array.isArray(parsed) || parsed.length > 0;
  } catch {
    return true;
  }
}

function sameDirectoryGeocodingLookupAddress(
  left: DirectoryPublicAddress,
  right: DirectoryPublicAddress,
) {
  return normalizeStreetAddress(left.addressLine1) === normalizeStreetAddress(right.addressLine1)
    && normalizePostcode(left.postalCode) === normalizePostcode(right.postalCode)
    && normalizeText(left.city) === normalizeText(right.city);
}

export function selectDirectoryGeocodingAddress(input: {
  profileAddress: DirectoryPublicAddress;
  scbWorkplaces: unknown;
  scbConflicts: unknown;
}): DirectoryGeocodingAddressSelection | null {
  if (hasScbConflicts(input.scbConflicts)) return null;
  const resolution = resolveCompanyDirectoryCanonicalWorkplaceAddress(
    input.profileAddress,
    parseJsonArray(input.scbWorkplaces),
  );
  if (resolution.status !== "resolved") return null;
  return {
    address: resolution.address,
    source: "scb_workplace",
  };
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(value ?? ""));
}

function assertBeforeDeadline(deadline: number, reserveMs = 0) {
  if (Date.now() + reserveMs >= deadline) throw new GeocodingDeadlineExceeded();
}

function requestTimeout(deadline: number) {
  const timeoutMs = Math.min(
    UPSTREAM_REQUEST_TIMEOUT_MS,
    deadline - Date.now() - FETCH_DEADLINE_GUARD_MS,
  );
  if (timeoutMs < 1_000) throw new GeocodingDeadlineExceeded();
  return {
    timeoutMs,
    deadlineBound: timeoutMs < UPSTREAM_REQUEST_TIMEOUT_MS,
  };
}

function isAbortLikeFetchError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  return name === "TimeoutError" || name === "AbortError";
}

export function mapDirectoryGeocodingFetchError(error: unknown, deadlineBound: boolean) {
  if (deadlineBound && isAbortLikeFetchError(error)) return new GeocodingDeadlineExceeded();
  return error;
}

export function classifyDirectoryGeocodingBatchError(error: unknown) {
  return error instanceof GeocodingDeadlineExceeded ? "deadline" as const : "error" as const;
}

export function buildDirectoryGeocodingNoMatchSource(
  reason: DirectoryGeocodingNoMatchReason,
  addressSource: DirectoryGeocodingAddressSource = "profile",
) {
  return addressSource === "scb_workplace"
    ? `${REGISTER_UNIT_NO_MATCH_SOURCE_PREFIX}${reason}`
    : `${NO_MATCH_SOURCE}:${reason}`;
}

export function isDirectoryGeocodingNoMatchSource(value: unknown) {
  const source = String(value ?? "");
  return source === NO_MATCH_SOURCE || source.startsWith(`${NO_MATCH_SOURCE}:`);
}

export function shouldRetryLegacyDirectoryNoMatch(organizationNumber: unknown, source: unknown) {
  return String(source ?? "") === NO_MATCH_SOURCE
    && (DIRECTORY_GEOCODING_DIAGNOSTIC_RETRY_ORGS as readonly string[])
      .includes(String(organizationNumber ?? ""));
}

export function shouldRetryDirectoryNoMatchAfterRegisterUnitFix(source: unknown) {
  const normalizedSource = String(source ?? "");
  return isDirectoryGeocodingNoMatchSource(normalizedSource)
    && !normalizedSource.startsWith(REGISTER_UNIT_NO_MATCH_SOURCE_PREFIX);
}

export function shouldRetryDirectoryNoMatchWithCanonicalAddress(input: {
  geocodeSource: unknown;
  profileAddress: DirectoryPublicAddress;
  selectedAddress: DirectoryGeocodingAddressSelection;
}) {
  const source = String(input.geocodeSource ?? "");
  if (!isDirectoryGeocodingNoMatchSource(source)) return false;
  if (source.startsWith(SCB_WORKPLACE_NO_MATCH_SOURCE_PREFIX)) return false;
  if (source.startsWith(REGISTER_UNIT_NO_MATCH_SOURCE_PREFIX)) return false;
  if (input.selectedAddress.source !== "scb_workplace") return false;
  return !sameDirectoryGeocodingLookupAddress(
    input.profileAddress,
    input.selectedAddress.address,
  );
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

function referenceAddressComponents(reference: LantmaterietAddressReference) {
  if (reference.adressComponents) return reference.adressComponents;
  if (reference.adress && typeof reference.adress === "object" && !Array.isArray(reference.adress)) {
    return reference.adress;
  }
  return undefined;
}

export function selectUniqueDirectoryAddressReference(
  references: LantmaterietAddressReference[],
  postalCode: unknown,
  city: unknown,
) {
  const expectedPostcode = normalizePostcode(postalCode);
  const expectedCity = normalizeText(city);
  const matches = references.filter((reference) => {
    const components = referenceAddressComponents(reference);
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

  return references.filter((reference) => {
    if (!isUuid(reference.objektidentitet)) return false;
    const components = referenceAddressComponents(reference);
    const referencePostcode = normalizePostcode(components?.postnummer);
    const referenceCity = normalizeText(components?.postort);
    const postcodeCompatible = !referencePostcode || referencePostcode === expectedPostcode;
    const cityCompatible = !referenceCity || referenceCity === expectedCity;
    return postcodeCompatible && cityCompatible;
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

function detailStreetAddresses(properties: AddressDetailProperties) {
  const designation = properties.adressplatsattribut?.adressplatsbeteckning;
  if (!designation) return [];

  const alternate = String(designation.avvikandeAdressplatsbeteckning ?? "").trim();
  const number = String(designation.adressplatsnummer ?? "").trim();
  const letter = String(designation.bokstavstillagg ?? "").trim();
  const location = String(designation.lagestillagg ?? "").trim();
  const locationNumber = String(designation.lagestillaggsnummer ?? "").trim();
  const place = alternate || (number
    ? `${number}${letter}${location ? ` ${location}${locationNumber}` : ""}`
    : "");
  if (!place) return [];

  const area = String(properties.adressomrade?.faststalltNamn ?? "").trim();
  const farmArea = String(properties.gardsadressomrade?.faststalltNamn ?? "").trim();
  const areaNames = [
    area,
    farmArea,
    area && farmArea ? `${area} ${farmArea}` : "",
  ].filter(Boolean);

  return [...new Set(areaNames.map((areaName) => `${areaName} ${place}`.trim()))];
}

export function diagnoseExactSwerefAddressDetail(
  payload: unknown,
  postalCode: unknown,
  city: unknown,
  streetAddress: unknown,
): AddressDetailDiagnostic {
  if (!payload || typeof payload !== "object") {
    return { point: null, reason: "unexpected_detail_response" };
  }
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length !== 1) {
    return { point: null, reason: "unexpected_detail_response" };
  }
  const feature = features[0];
  if (!feature || typeof feature !== "object") {
    return { point: null, reason: "unexpected_detail_response" };
  }
  const properties = (feature as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") {
    return { point: null, reason: "unexpected_detail_response" };
  }
  const typedProperties = properties as AddressDetailProperties;
  const addressAttributes = typedProperties.adressplatsattribut;
  if (
    !addressAttributes
    || typeof addressAttributes !== "object"
    || Array.isArray(addressAttributes)
  ) {
    return { point: null, reason: "unexpected_detail_response" };
  }
  if (
    normalizePostcode(addressAttributes.postnummer) !== normalizePostcode(postalCode)
    || normalizeText(addressAttributes.postort) !== normalizeText(city)
  ) {
    return { point: null, reason: "postal_mismatch" };
  }

  const expectedStreet = normalizeStreetAddress(streetAddress);
  if (!expectedStreet) return { point: null, reason: "invalid_address" };
  const officialStreets = detailStreetAddresses(typedProperties).map(normalizeStreetAddress);
  if (!officialStreets.includes(expectedStreet)) {
    return { point: null, reason: "street_mismatch" };
  }

  const point = parseSwerefPointGeometry(payload);
  if (!point) return { point: null, reason: "missing_point" };
  return { point, reason: null };
}

function exactAddressFeatureId(feature: Record<string, unknown>, properties: AddressDetailProperties) {
  const featureId = feature.id;
  const propertyId = properties.objektidentitet;
  if (featureId !== undefined && featureId !== null && !isUuid(featureId)) return null;
  if (propertyId !== undefined && propertyId !== null && !isUuid(propertyId)) return null;
  const normalizedFeatureId = isUuid(featureId) ? String(featureId) : "";
  const normalizedPropertyId = isUuid(propertyId) ? String(propertyId) : "";
  if (
    normalizedFeatureId
    && normalizedPropertyId
    && normalizedFeatureId.toLowerCase() !== normalizedPropertyId.toLowerCase()
  ) return null;
  return normalizedFeatureId || normalizedPropertyId || null;
}

function registerUnitReferences(properties: AddressDetailProperties) {
  const raw = properties.registerenhetsreferens;
  if (raw === null || raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function registerUnitReferenceMatches(properties: AddressDetailProperties, registerUnitId: string) {
  const references = registerUnitReferences(properties);
  if (references.length === 0) return true;
  if (references.some((reference) => !isUuid(reference?.objektidentitet))) return false;
  return references.some((reference) =>
    String(reference.objektidentitet).toLowerCase() === registerUnitId.toLowerCase());
}

export function diagnoseExactSwerefAddressFromRegisterUnit(
  payload: unknown,
  registerUnitId: unknown,
  postalCode: unknown,
  city: unknown,
  streetAddress: unknown,
): RegisterUnitAddressDiagnostic {
  if (!isUuid(registerUnitId)) {
    return { point: null, addressId: null, reason: "invalid_reference" };
  }
  if (!payload || typeof payload !== "object") {
    return { point: null, addressId: null, reason: "unexpected_detail_response" };
  }
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) {
    return { point: null, addressId: null, reason: "unexpected_detail_response" };
  }

  const matches: Array<{ point: SwerefPoint; addressId: string }> = [];
  const reasons = new Set<DirectoryGeocodingNoMatchReason>();
  for (const feature of features) {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
      reasons.add("unexpected_detail_response");
      continue;
    }
    const exact = diagnoseExactSwerefAddressDetail(
      { type: "FeatureCollection", features: [feature] },
      postalCode,
      city,
      streetAddress,
    );
    if (!exact.point) {
      reasons.add(exact.reason);
      continue;
    }
    const properties = (feature as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      reasons.add("unexpected_detail_response");
      continue;
    }
    const typedProperties = properties as AddressDetailProperties;
    const addressId = exactAddressFeatureId(feature as Record<string, unknown>, typedProperties);
    if (!addressId || !registerUnitReferenceMatches(typedProperties, String(registerUnitId))) {
      reasons.add("invalid_reference");
      continue;
    }
    matches.push({ point: exact.point, addressId });
  }

  if (matches.length > 1) {
    return { point: null, addressId: null, reason: "ambiguous_exact_match" };
  }
  if (matches.length === 1) {
    return { ...matches[0], reason: null };
  }
  if (reasons.size === 1) {
    return { point: null, addressId: null, reason: [...reasons][0] };
  }
  return { point: null, addressId: null, reason: "no_exact_detail_match" };
}

export function parseExactSwerefAddressDetail(
  payload: unknown,
  postalCode: unknown,
  city: unknown,
  streetAddress: unknown,
) {
  return diagnoseExactSwerefAddressDetail(payload, postalCode, city, streetAddress).point;
}

function geocodingEnabled() {
  return process.env.COMPANY_DIRECTORY_GEOCODING_ENABLED?.trim().toLowerCase() === "true";
}

function normalizeApprovedBaseUrl(input: {
  rawUrl: string;
  fallbackUrl: string;
  expectedPath: string;
}) {
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(input.rawUrl);
  } catch {
    parsedUrl = null;
  }

  const allowedProtocol = parsedUrl?.protocol === "https:";
  const allowedHost = parsedUrl?.hostname === "api.lantmateriet.se"
    || parsedUrl?.hostname === "api-ver.lantmateriet.se";
  const allowedPath = parsedUrl?.pathname === input.expectedPath
    || parsedUrl?.pathname === `${input.expectedPath}/`;
  const accepted = Boolean(parsedUrl) && allowedProtocol && allowedHost && allowedPath;
  const normalizedUrl = parsedUrl
    ? `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, "")
    : input.fallbackUrl;

  return {
    accepted,
    baseUrl: accepted ? normalizedUrl : input.fallbackUrl,
  };
}

function lookupBaseForDetailEnvironment(detailBaseUrl: string) {
  const detailUrl = new URL(detailBaseUrl);
  return `${detailUrl.origin}/distribution/produkter/uppslag/adress/v3`;
}

function sameApiEnvironment(leftBaseUrl: string, rightBaseUrl: string) {
  return new URL(leftBaseUrl).hostname === new URL(rightBaseUrl).hostname;
}

export function resolveDirectoryGeocodingApiBases(input: {
  detailBaseUrl?: string;
  lookupBaseUrl?: string;
}) {
  const rawDetailBase = input.detailBaseUrl?.trim() || DEFAULT_LANTMATERIET_DETAIL_BASE_URL;
  const detail = normalizeApprovedBaseUrl({
    rawUrl: rawDetailBase,
    fallbackUrl: DEFAULT_LANTMATERIET_DETAIL_BASE_URL,
    expectedPath: "/distribution/produkter/belagenhetsadress/v4.2",
  });
  const derivedLookupBase = lookupBaseForDetailEnvironment(detail.baseUrl);
  const rawLookupBase = input.lookupBaseUrl?.trim() || derivedLookupBase;
  const lookup = normalizeApprovedBaseUrl({
    rawUrl: rawLookupBase,
    fallbackUrl: detail.accepted ? derivedLookupBase : DEFAULT_LANTMATERIET_LOOKUP_BASE_URL,
    expectedPath: "/distribution/produkter/uppslag/adress/v3",
  });
  const accepted = detail.accepted
    && lookup.accepted
    && sameApiEnvironment(detail.baseUrl, lookup.baseUrl);

  return {
    accepted,
    lookupBaseUrl: lookup.baseUrl,
    detailBaseUrl: detail.baseUrl,
  };
}

function getGeocodingConfig() {
  const enabled = geocodingEnabled();
  const username = process.env.LANTMATERIET_ADDRESS_API_USERNAME?.trim() ?? "";
  const password = process.env.LANTMATERIET_ADDRESS_API_PASSWORD?.trim() ?? "";
  const apiBases = resolveDirectoryGeocodingApiBases({
    detailBaseUrl: process.env.LANTMATERIET_ADDRESS_API_BASE_URL,
    lookupBaseUrl: process.env.LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL,
  });

  return {
    enabled,
    username,
    password,
    lookupBaseUrl: apiBases.lookupBaseUrl,
    detailBaseUrl: apiBases.detailBaseUrl,
    configured: enabled
      && Boolean(username)
      && Boolean(password)
      && apiBases.accepted,
  };
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
}

function authorizationHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

async function fetchJson(url: URL, username: string, password: string, deadline: number) {
  assertBeforeDeadline(deadline);
  const { timeoutMs, deadlineBound } = requestTimeout(deadline);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: authorizationHeader(username, password),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Lantmäteriet request failed (${response.status})`);
    return await response.json() as unknown;
  } catch (error) {
    throw mapDirectoryGeocodingFetchError(error, deadlineBound);
  }
}

async function fetchAddressReferences(
  streetAddress: string,
  city: string,
  config: ReturnType<typeof getGeocodingConfig>,
  deadline: number,
) {
  const primaryText = buildDirectoryAddressSearchText(streetAddress, city);
  const searchUrl = new URL(`${config.lookupBaseUrl}/fritext`);
  searchUrl.searchParams.set("adress", primaryText);
  let payload = await fetchJson(searchUrl, config.username, config.password, deadline);
  if (!Array.isArray(payload) || payload.length > 0 || primaryText === streetAddress) return payload;

  const streetOnlyUrl = new URL(`${config.lookupBaseUrl}/fritext`);
  streetOnlyUrl.searchParams.set("adress", streetAddress);
  payload = await fetchJson(streetOnlyUrl, config.username, config.password, deadline);
  return payload;
}

async function resolveOfficialAddress(
  profile: PilotProfile,
  config: ReturnType<typeof getGeocodingConfig>,
  deadline: number,
): Promise<OfficialAddressResolution> {
  assertBeforeDeadline(deadline);
  const streetAddress = cleanDirectoryStreetAddress(profile.addressLine1);
  if (!streetAddress || streetAddress.toLocaleLowerCase("sv-SE").startsWith("box ")) {
    return { status: "no_match", reason: "invalid_address" };
  }

  const referencePayload = await fetchAddressReferences(streetAddress, profile.city, config, deadline);
  if (!Array.isArray(referencePayload)) {
    return { status: "no_match", reason: "unexpected_reference_response" };
  }
  if (referencePayload.length === 0) {
    return { status: "no_match", reason: "no_reference" };
  }

  const references = referencePayload as LantmaterietAddressReference[];
  if (!references.some((reference) => isUuid(reference.objektidentitet))) {
    return { status: "no_match", reason: "invalid_reference" };
  }

  const candidates = selectDirectoryAddressReferenceCandidates(
    references,
    profile.postalCode,
    profile.city,
  );
  if (candidates.length === 0) {
    return { status: "no_match", reason: "reference_postal_mismatch" };
  }
  if (candidates.length > MAX_DETAIL_FALLBACK_CANDIDATES) {
    return { status: "no_match", reason: "too_many_candidates" };
  }

  let resolved: { easting: number; northing: number; objectId: string } | null = null;
  const detailReasons = new Set<DirectoryGeocodingNoMatchReason>();

  for (const candidate of candidates) {
    assertBeforeDeadline(deadline);
    const registerUnitId = String(candidate.objektidentitet ?? "");
    if (!isUuid(registerUnitId)) continue;
    const detailUrl = new URL(
      `${config.detailBaseUrl}/registerenhet/${encodeURIComponent(registerUnitId)}`,
    );
    detailUrl.searchParams.set("includeData", "basinformation");
    detailUrl.searchParams.set("srid", "3006");
    const detailPayload = await fetchJson(detailUrl, config.username, config.password, deadline);
    const detail = diagnoseExactSwerefAddressFromRegisterUnit(
      detailPayload,
      registerUnitId,
      profile.postalCode,
      profile.city,
      streetAddress,
    );
    if (!detail.point) {
      detailReasons.add(detail.reason);
      continue;
    }
    if (resolved) return { status: "no_match", reason: "ambiguous_exact_match" };
    resolved = { ...detail.point, objectId: detail.addressId };
  }

  if (resolved) return { status: "matched", ...resolved };
  if (detailReasons.size === 1) {
    return { status: "no_match", reason: [...detailReasons][0] };
  }
  return { status: "no_match", reason: "no_exact_detail_match" };
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

function profileAddressFromRow(row: Record<string, unknown>): DirectoryPublicAddress {
  return {
    addressLine1: String(row.address_line1 ?? "").trim(),
    postalCode: String(row.postal_code ?? "").trim(),
    city: String(row.city ?? "").trim(),
    municipality: String(row.municipality ?? "").trim(),
  };
}

function selectedAddressFromRow(row: Record<string, unknown>) {
  return selectDirectoryGeocodingAddress({
    profileAddress: profileAddressFromRow(row),
    scbWorkplaces: row.scb_workplaces,
    scbConflicts: row.scb_conflicts,
  });
}

function rowNeedsGeocodingAttempt(row: Record<string, unknown>) {
  const latitude = row.latitude;
  const longitude = row.longitude;
  if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
    return false;
  }
  const selectedAddress = selectedAddressFromRow(row);
  if (!selectedAddress) return false;
  const source = String(row.geocode_source ?? "");
  if (!isDirectoryGeocodingNoMatchSource(source)) return true;
  return shouldRetryDirectoryNoMatchAfterRegisterUnitFix(source);
}

async function pilotCounts(deadline?: number) {
  if (deadline) assertBeforeDeadline(deadline);
  const sql = getSql();
  if (!sql) {
    return { geocoded: 0, remaining: DIRECTORY_GEOCODING_PILOT_ORGS.length, needsReview: 0 };
  }
  const orgsJson = JSON.stringify(DIRECTORY_GEOCODING_PILOT_ORGS);
  const rows = await sql`
    select
      profile.organization_number,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      location.latitude::float8 as latitude,
      location.longitude::float8 as longitude,
      location.geocode_source,
      scb.workplaces as scb_workplaces,
      scb.conflicts as scb_conflicts
    from company_directory_profiles profile
    left join company_directory_business_locations location on location.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.organization_number in (
      select jsonb_array_elements_text(${orgsJson}::jsonb)
    )
      and profile.publication_status in ('ready', 'published')
      and profile.is_active = true
      and profile.privacy_blocked = false
  `;

  let geocoded = 0;
  let remaining = 0;
  let needsReview = 0;
  for (const row of rows as Record<string, unknown>[]) {
    const hasCoordinates = row.latitude !== null
      && row.latitude !== undefined
      && row.longitude !== null
      && row.longitude !== undefined;
    if (hasCoordinates) {
      geocoded += 1;
      continue;
    }
    if (rowNeedsGeocodingAttempt(row)) {
      remaining += 1;
      continue;
    }
    if (isDirectoryGeocodingNoMatchSource(row.geocode_source)) needsReview += 1;
  }
  return { geocoded, remaining, needsReview };
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

async function markNoMatch(
  profileId: string,
  reason: DirectoryGeocodingNoMatchReason,
  addressSource: DirectoryGeocodingAddressSource,
  deadline?: number,
) {
  if (deadline) assertBeforeDeadline(deadline);
  const sql = getSql();
  if (!sql) return;
  const source = buildDirectoryGeocodingNoMatchSource(reason, addressSource);
  await sql`
    insert into company_directory_business_locations (
      profile_id, geocode_source, geocode_precision, geocode_confidence,
      is_public, geocoded_at, updated_at
    ) values (
      ${profileId}::uuid, ${source}, 'unknown', 0, false, now(), now()
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
  const actionDeadline = Date.now() + GEOCODING_ACTION_BUDGET_MS;
  const processingDeadline = actionDeadline - GEOCODING_FINAL_COUNTS_RESERVE_MS;

  await requireSuperAdmin();
  assertBeforeDeadline(actionDeadline);
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const config = getGeocodingConfig();
  if (!config.configured) throw new Error("Lantmäteriet geocoding is not configured");
  assertBeforeDeadline(actionDeadline);
  if (!(await postgisReady())) throw new Error("PostGIS is not installed");

  assertBeforeDeadline(processingDeadline);
  const boundedLimit = Math.max(1, Math.min(5, Math.floor(Number(limit) || 5)));
  const orgsJson = JSON.stringify(DIRECTORY_GEOCODING_PILOT_ORGS);
  const rows = await sql`
    select
      profile.id::text,
      profile.organization_number,
      profile.display_name,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      location.latitude::float8 as latitude,
      location.longitude::float8 as longitude,
      location.geocode_source,
      scb.workplaces as scb_workplaces,
      scb.conflicts as scb_conflicts
    from company_directory_profiles profile
    left join company_directory_business_locations location on location.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.organization_number in (
      select jsonb_array_elements_text(${orgsJson}::jsonb)
    )
      and profile.publication_status in ('ready', 'published')
      and profile.is_active = true
      and profile.privacy_blocked = false
      and (location.latitude is null or location.longitude is null)
    order by profile.category_slug, profile.display_name
  `;

  const candidates = (rows as Record<string, unknown>[])
    .filter(rowNeedsGeocodingAttempt)
    .slice(0, boundedLimit);

  let attempted = 0;
  let geocoded = 0;
  let noMatch = 0;
  let errors = 0;

  for (const row of candidates) {
    if (Date.now() >= processingDeadline) break;
    const selectedAddress = selectedAddressFromRow(row);
    if (!selectedAddress) continue;
    attempted += 1;
    const profile: PilotProfile = {
      id: String(row.id),
      organizationNumber: String(row.organization_number),
      companyName: String(row.display_name),
      addressLine1: selectedAddress.address.addressLine1,
      postalCode: selectedAddress.address.postalCode,
      city: selectedAddress.address.city,
      addressSource: selectedAddress.source,
    };
    try {
      const resolution = await resolveOfficialAddress(profile, config, processingDeadline);
      assertBeforeDeadline(processingDeadline);
      if (resolution.status === "no_match") {
        await markNoMatch(profile.id, resolution.reason, profile.addressSource, processingDeadline);
        noMatch += 1;
        continue;
      }
      assertBeforeDeadline(processingDeadline);
      const saved = await sql`
        with transformed as (
          select ST_Transform(
            ST_SetSRID(ST_MakePoint(${resolution.easting}, ${resolution.northing}), 3006),
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
    } catch (error) {
      if (classifyDirectoryGeocodingBatchError(error) === "deadline") break;
      errors += 1;
    }
  }

  const counts = await pilotCounts(actionDeadline);
  return {
    attempted,
    geocoded,
    noMatch,
    errors,
    remaining: counts.remaining,
    needsReview: counts.needsReview,
  };
}
