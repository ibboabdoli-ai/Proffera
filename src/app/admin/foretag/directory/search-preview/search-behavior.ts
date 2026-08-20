type PositionLike = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type MutableLocationField = {
  value: string;
};

export const ADMIN_DIRECTORY_NEARBY_COOKIE = "proffera_admin_directory_nearby";

/** Clears a conflicting manual city whenever an admin edits a raw Nearby coordinate. */
export function applyAdminManualCoordinateEdit(
  value: string,
  manualLocationField: MutableLocationField | null,
) {
  if (manualLocationField) {
    manualLocationField.value = "";
  }

  return value;
}

/** Converts browser geolocation into normalized coordinates and activates Nearby mode. */
export function applyAdminCurrentPosition(
  position: PositionLike,
  manualLocationField: MutableLocationField | null,
) {
  if (manualLocationField) {
    manualLocationField.value = "";
  }

  return {
    latitude: position.coords.latitude.toFixed(6),
    longitude: position.coords.longitude.toFixed(6),
    status: "Position hämtad. Platsfältet är rensat. Tryck Sök.",
  };
}

/** Validates and normalizes one complete latitude/longitude pair for Nearby search. */
export function parseAdminNearbyCoordinatePair(
  rawLatitude?: string | null,
  rawLongitude?: string | null,
) {
  const latitudeValue = String(rawLatitude ?? "").trim();
  const longitudeValue = String(rawLongitude ?? "").trim();
  if (!latitudeValue || !longitudeValue) return null;

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  };
}

/** Validates the short-lived coordinate value used by the admin Nearby POST flow. */
export function parseAdminNearbyCoordinates(rawValue?: string | null) {
  const parts = String(rawValue ?? "")
    .split(",")
    .map((part) => part.trim());

  if (parts.length !== 2) return null;
  return parseAdminNearbyCoordinatePair(parts[0], parts[1]);
}

/** Builds the post-Nearby redirect URL without putting coordinates in query parameters. */
export function buildAdminNearbySearchDestination({
  service,
  radius,
}: {
  service?: string;
  radius?: string;
}) {
  const normalizedService = String(service ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const normalizedRadius = ["25", "50", "100"].includes(String(radius ?? "")) ? String(radius) : "25";
  const params = new URLSearchParams({
    nearby: "1",
    service: normalizedService,
    radius: normalizedRadius,
  });

  return `/admin/foretag/directory/search-preview?${params.toString()}`;
}

/** Resolves one mutually exclusive admin search mode from manual location or a complete valid coordinate pair. */
export function resolveAdminDirectorySearchMode({
  location,
  latitude,
  longitude,
}: {
  location?: string;
  latitude?: string;
  longitude?: string;
}) {
  const locationWasProvided = location !== undefined;
  const locationValue = location ?? "";

  if (locationValue.trim().length > 0) {
    return {
      location: locationValue,
      latitude: undefined,
      longitude: undefined,
    };
  }

  const coordinates = parseAdminNearbyCoordinatePair(latitude, longitude);
  if (coordinates) {
    return {
      location: "",
      ...coordinates,
    };
  }

  return {
    location: locationWasProvided ? locationValue : "Stockholm",
    latitude: undefined,
    longitude: undefined,
  };
}
