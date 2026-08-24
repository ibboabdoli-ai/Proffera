export type BusinessProfileLocationPurpose =
  | "registered"
  | "postal"
  | "workplace"
  | "storefront"
  | "service_base";

export type BusinessProfileLocationVisibility = "private" | "approximate" | "public";
export type BusinessProfileLocationSource = "official" | "scb" | "owner" | "admin";

export type BusinessProfileLocationCandidate = {
  profileId: string;
  purpose: BusinessProfileLocationPurpose;
  visibility: BusinessProfileLocationVisibility;
  isVisitable: boolean;
  sourceType: BusinessProfileLocationSource;
  claimedWorkspaceId?: string | null;
  sourceWorkspaceId?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  municipality?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  confirmedAt?: string | Date | null;
};

export type PublicBusinessProfileLocation = {
  profileId: string;
  purpose: BusinessProfileLocationPurpose;
  visibility: "approximate" | "public";
  isVisitable: boolean;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  mapPoint: null | {
    latitude: number;
    longitude: number;
  };
};

const EXACT_PUBLIC_PURPOSES = new Set<BusinessProfileLocationPurpose>([
  "workplace",
  "storefront",
  "service_base",
]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedUuidLike(value: unknown) {
  return text(value).toLowerCase();
}

function isConfirmed(value: unknown) {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  const normalized = text(value);
  if (!normalized) return false;
  return Number.isFinite(Date.parse(normalized));
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === null || normalized === undefined || normalized === "") return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
}

function ownerBindingIsValid(candidate: BusinessProfileLocationCandidate) {
  if (candidate.sourceType !== "owner") return true;
  const claimedWorkspaceId = normalizedUuidLike(candidate.claimedWorkspaceId);
  const sourceWorkspaceId = normalizedUuidLike(candidate.sourceWorkspaceId);
  return Boolean(claimedWorkspaceId && sourceWorkspaceId && claimedWorkspaceId === sourceWorkspaceId);
}

/**
 * Convert one location candidate into the maximum public-safe projection.
 *
 * Privacy invariants:
 * - private locations never leave the resolver;
 * - registered/postal addresses are never promoted into an exact map location;
 * - exact street/map disclosure requires an explicitly public, confirmed,
 *   visitable workplace/storefront/service-base;
 * - owner locations are rejected unless they are bound to the Workspace that
 *   currently owns the Directory profile;
 * - approximate output contains locality only and never precise coordinates.
 */
export function resolvePublicBusinessProfileLocation(
  candidate: BusinessProfileLocationCandidate,
): PublicBusinessProfileLocation | null {
  if (!text(candidate.profileId) || candidate.visibility === "private") return null;
  if (!ownerBindingIsValid(candidate)) return null;

  const exactPurpose = EXACT_PUBLIC_PURPOSES.has(candidate.purpose);
  const exactPublic = Boolean(
    candidate.visibility === "public"
    && exactPurpose
    && candidate.isVisitable
    && isConfirmed(candidate.confirmedAt),
  );

  const latitude = finiteCoordinate(candidate.latitude, -90, 90);
  const longitude = finiteCoordinate(candidate.longitude, -180, 180);
  const mapPoint = exactPublic && latitude !== null && longitude !== null
    ? { latitude, longitude }
    : null;

  return {
    profileId: text(candidate.profileId),
    purpose: candidate.purpose,
    visibility: exactPublic ? "public" : "approximate",
    isVisitable: exactPublic,
    addressLine1: exactPublic ? text(candidate.addressLine1) : "",
    postalCode: exactPublic ? text(candidate.postalCode) : "",
    city: text(candidate.city),
    municipality: text(candidate.municipality),
    mapPoint,
  };
}
