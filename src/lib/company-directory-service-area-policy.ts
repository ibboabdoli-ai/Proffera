import {
  calculateDirectoryDistanceKm,
  parseDirectoryCoordinates,
  type DirectoryCoordinates,
} from "@/lib/company-directory-distance";

export const COMPANY_DIRECTORY_SERVICE_AREA_MIN_KM = 1;
export const COMPANY_DIRECTORY_SERVICE_AREA_MAX_KM = 300;

export type CompanyDirectoryGeoCoverageState =
  | "confirmed_inside"
  | "confirmed_outside"
  | "inferred_nearby"
  | "locality_fallback"
  | "unknown";

export type CompanyDirectoryGeoCoverageResult = {
  state: CompanyDirectoryGeoCoverageState;
  distanceKm: number | null;
  radiusKm: number | null;
};

type CoordinateState =
  | { kind: "valid"; point: DirectoryCoordinates }
  | { kind: "missing" }
  | { kind: "invalid" };

function missingCoordinateValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function coordinateState(
  latitude: unknown,
  longitude: unknown,
  options: { zeroPairIsMissing?: boolean } = {},
): CoordinateState {
  const latitudeMissing = missingCoordinateValue(latitude);
  const longitudeMissing = missingCoordinateValue(longitude);
  if (latitudeMissing && longitudeMissing) return { kind: "missing" };
  if (latitudeMissing || longitudeMissing) return { kind: "invalid" };

  const point = parseDirectoryCoordinates(latitude, longitude);
  if (!point) return { kind: "invalid" };
  if (point.latitude === 0 && point.longitude === 0) {
    return options.zeroPairIsMissing ? { kind: "missing" } : { kind: "invalid" };
  }
  return { kind: "valid", point };
}

export function normalizeCompanyDirectoryServiceAreaRadius(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const radiusKm = Number(value);
  if (!Number.isFinite(radiusKm)) return null;
  if (radiusKm < COMPANY_DIRECTORY_SERVICE_AREA_MIN_KM || radiusKm > COMPANY_DIRECTORY_SERVICE_AREA_MAX_KM) return null;
  return radiusKm;
}

export function hasConfirmedCompanyDirectoryServiceArea(input: {
  radiusKm: unknown;
  publicVisible: boolean;
  confirmedAt: unknown;
}) {
  return Boolean(
    input.publicVisible
    && input.confirmedAt
    && normalizeCompanyDirectoryServiceAreaRadius(input.radiusKm) !== null,
  );
}

export function classifyCompanyDirectoryGeoCoverage(input: {
  providerLatitude?: unknown;
  providerLongitude?: unknown;
  providerPointVerified?: boolean;
  customerLatitude?: unknown;
  customerLongitude?: unknown;
  confirmedRadiusKm?: unknown;
  localityMatched?: boolean;
  fallbackMaxDistanceKm?: number;
}): CompanyDirectoryGeoCoverageResult {
  const radiusKm = normalizeCompanyDirectoryServiceAreaRadius(input.confirmedRadiusKm);
  const provider = coordinateState(input.providerLatitude, input.providerLongitude);
  if (provider.kind !== "valid") return { state: "unknown", distanceKm: null, radiusKm };

  const customer = coordinateState(input.customerLatitude, input.customerLongitude, { zeroPairIsMissing: true });
  if (customer.kind === "invalid") return { state: "unknown", distanceKm: null, radiusKm };
  if (customer.kind === "missing") {
    return {
      state: input.localityMatched ? "locality_fallback" : "unknown",
      distanceKm: null,
      radiusKm,
    };
  }

  const distanceKm = calculateDirectoryDistanceKm(customer.point, provider.point);
  if (radiusKm !== null) {
    if (!input.providerPointVerified) return { state: "unknown", distanceKm, radiusKm };
    return {
      state: distanceKm <= radiusKm ? "confirmed_inside" : "confirmed_outside",
      distanceKm,
      radiusKm,
    };
  }

  const fallbackMaxDistanceKm = Number(input.fallbackMaxDistanceKm ?? 50);
  if (
    Number.isFinite(fallbackMaxDistanceKm)
    && fallbackMaxDistanceKm >= 0
    && distanceKm <= fallbackMaxDistanceKm
  ) {
    return { state: "inferred_nearby", distanceKm, radiusKm: null };
  }

  return { state: "unknown", distanceKm, radiusKm: null };
}

export function confirmedCompanyDirectoryServiceAreaCoversSearch(input: {
  radiusKm: unknown;
  nearbyEnabled: boolean;
  distanceKm: unknown;
}) {
  const radiusKm = normalizeCompanyDirectoryServiceAreaRadius(input.radiusKm);
  if (radiusKm === null) return false;
  if (!input.nearbyEnabled) return true;

  const distanceKm = Number(input.distanceKm);
  return Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm <= radiusKm;
}
