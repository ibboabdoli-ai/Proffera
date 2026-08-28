import { parseDirectoryCoordinates } from "@/lib/company-directory-distance";
import type { PublicLocale } from "@/lib/public-locale";

const PUBLIC_DIRECTORY_NEARBY_COOKIE_NAMES: Record<PublicLocale, string> = {
  sv: "proffera_public_directory_nearby_sv",
  en: "proffera_public_directory_nearby_en",
};

const PUBLIC_DIRECTORY_NEARBY_COOKIE_PATHS: Record<PublicLocale, string> = {
  sv: "/foretag/listad",
  en: "/en/companies",
};

export function publicDirectoryNearbyCookieName(locale: PublicLocale) {
  return PUBLIC_DIRECTORY_NEARBY_COOKIE_NAMES[locale];
}

export function publicDirectoryNearbyCookiePath(locale: PublicLocale) {
  return PUBLIC_DIRECTORY_NEARBY_COOKIE_PATHS[locale];
}

/** Parses one short-lived private Nearby cookie value into a validated coordinate pair. */
export function parsePublicDirectoryNearbyValue(rawValue?: string | null) {
  const parts = String(rawValue ?? "")
    .split(",")
    .map((part) => part.trim());

  if (parts.length !== 2) return null;
  return parseDirectoryCoordinates(parts[0], parts[1]);
}

/** Normalizes browser coordinates before they are stored in a short-lived HttpOnly cookie. */
export function serializePublicDirectoryNearbyValue(rawValue?: string | null) {
  const coordinates = parsePublicDirectoryNearbyValue(rawValue);
  if (!coordinates) return null;
  return `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`;
}
