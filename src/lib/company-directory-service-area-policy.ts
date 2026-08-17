export const COMPANY_DIRECTORY_SERVICE_AREA_MIN_KM = 1;
export const COMPANY_DIRECTORY_SERVICE_AREA_MAX_KM = 300;

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
