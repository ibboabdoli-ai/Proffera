import { parseDirectoryCoordinates } from "@/lib/company-directory-distance";

const VERIFIED_LANTMATERIET_GEOCODE_SOURCE = "lantmateriet_belagenhetsadress_v4_2";

export type ClaimedProviderMatchingOrigin = {
  kind: "owner_service_base" | "canonical_scb";
  latitude: unknown;
  longitude: unknown;
  city: string;
  municipality: string;
  pointVerified: boolean;
};

type OwnerServiceBaseEvidence = {
  candidateCount?: unknown;
  ownerWorkspaceId?: unknown;
  sourceType?: unknown;
  purpose?: unknown;
  isActive?: unknown;
  confirmedAt?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  geocodeSource?: unknown;
  geocodePrecision?: unknown;
  city?: unknown;
  municipality?: unknown;
};

type CanonicalProviderEvidence = {
  latitude?: unknown;
  longitude?: unknown;
  city?: unknown;
  municipality?: unknown;
  pointVerified?: boolean;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/**
 * A claimed-provider service base is matching authority only when it is unique,
 * owner-scoped to the claimed Workspace, explicitly confirmed, and backed by
 * the same exact Lantmäteriet address verification used for canonical points.
 * Visibility is intentionally not part of this internal matching contract.
 */
export function isVerifiedClaimedProviderServiceBase(input: {
  claimedWorkspaceId?: unknown;
  serviceBase?: OwnerServiceBaseEvidence | null;
}) {
  const serviceBase = input.serviceBase;
  if (!serviceBase) return false;
  const claimedWorkspaceId = text(input.claimedWorkspaceId);
  if (!claimedWorkspaceId || text(serviceBase.ownerWorkspaceId) !== claimedWorkspaceId) return false;
  if (Number(serviceBase.candidateCount) !== 1) return false;
  if (text(serviceBase.sourceType) !== "owner") return false;
  if (text(serviceBase.purpose) !== "service_base") return false;
  if (!Boolean(serviceBase.isActive) || !text(serviceBase.confirmedAt)) return false;
  if (text(serviceBase.geocodeSource) !== VERIFIED_LANTMATERIET_GEOCODE_SOURCE) return false;
  if (text(serviceBase.geocodePrecision) !== "address") return false;

  const point = parseDirectoryCoordinates(serviceBase.latitude, serviceBase.longitude);
  return Boolean(point && (point.latitude !== 0 || point.longitude !== 0));
}

/** Selects a verified owner service base first; otherwise preserves canonical SCB behavior. */
export function selectClaimedProviderMatchingOrigin(input: {
  claimedWorkspaceId?: unknown;
  serviceBase?: OwnerServiceBaseEvidence | null;
  canonical: CanonicalProviderEvidence;
}): ClaimedProviderMatchingOrigin {
  if (isVerifiedClaimedProviderServiceBase(input)) {
    const serviceBase = input.serviceBase!;
    return {
      kind: "owner_service_base",
      latitude: serviceBase.latitude,
      longitude: serviceBase.longitude,
      city: text(serviceBase.city),
      municipality: text(serviceBase.municipality),
      pointVerified: true,
    };
  }

  return {
    kind: "canonical_scb",
    latitude: input.canonical.latitude,
    longitude: input.canonical.longitude,
    city: text(input.canonical.city),
    municipality: text(input.canonical.municipality),
    pointVerified: Boolean(input.canonical.pointVerified),
  };
}
