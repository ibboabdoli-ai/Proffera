export type DirectoryCoordinates = {
  latitude: number;
  longitude: number;
};

function finiteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDirectoryCoordinates(latitude: unknown, longitude: unknown): DirectoryCoordinates | null {
  const lat = finiteNumber(latitude);
  const lng = finiteNumber(longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function normalizeDirectoryRadiusKm(value: unknown, fallback = 25) {
  const parsed = finiteNumber(value);
  if (parsed === null) return fallback;
  return Math.max(1, Math.min(100, parsed));
}

export function calculateDirectoryDistanceKm(a: DirectoryCoordinates, b: DirectoryCoordinates) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
