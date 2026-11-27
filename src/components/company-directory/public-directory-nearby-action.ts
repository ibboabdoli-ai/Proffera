"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  directoryPaths,
  normalizeDirectoryPublicServiceQuery,
} from "@/components/company-directory/public-directory-copy";
import { normalizeDirectoryRadiusKm, parseDirectoryCoordinates } from "@/lib/company-directory-distance";
import { getSql } from "@/lib/db/server";
import { verifyCustomerAddress } from "@/lib/lantmateriet-address-verification";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import type { PublicLocale } from "@/lib/public-locale";
import {
  publicDirectoryNearbyCookieName,
  publicDirectoryNearbyCookiePath,
  parsePublicDirectoryNearbyValue,
  serializePublicDirectoryNearbyValue,
} from "@/lib/public-directory-nearby";

const PUBLIC_DIRECTORY_NEARBY_COOKIE_MAX_AGE_SECONDS = 300;
const PUBLIC_DIRECTORY_LOCALES: PublicLocale[] = ["sv", "en"];

function publicNearbyCookieOptions(locale: PublicLocale, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: publicDirectoryNearbyCookiePath(locale),
  };
}

function publicLocale(value: FormDataEntryValue | null): PublicLocale {
  return value === "en" ? "en" : "sv";
}

/** Stores a validated customer position briefly and redirects without exposing exact coordinates in the URL. */
export async function searchPublicDirectoryNearbyAction(formData: FormData) {
  const locale = publicLocale(formData.get("locale"));
  const service = normalizeDirectoryPublicServiceQuery(
    String(formData.get("service") ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    locale,
  );
  const radius = String(Math.min(50, normalizeDirectoryRadiusKm(formData.get("radius"), 10)));
  const nearbyValue = serializePublicDirectoryNearbyValue(
    String(formData.get("nearbyCoordinates") ?? ""),
  );
  const params = new URLSearchParams({ nearby: "1", radius });
  if (service) params.set("service", service);

  const cookieStore = await cookies();
  for (const cookieLocale of PUBLIC_DIRECTORY_LOCALES) {
    cookieStore.set(
      publicDirectoryNearbyCookieName(cookieLocale),
      nearbyValue ?? "",
      publicNearbyCookieOptions(
        cookieLocale,
        nearbyValue ? PUBLIC_DIRECTORY_NEARBY_COOKIE_MAX_AGE_SECONDS : 0,
      ),
    );
  }

  redirect(`${directoryPaths[locale].search}?${params.toString()}`);
}


/** Refines a search without obtaining or exposing the already-valid private origin again. */
export async function refinePublicDirectoryNearbyAction(formData: FormData) {
  const locale = publicLocale(formData.get("locale"));
  const service = normalizeDirectoryPublicServiceQuery(
    String(formData.get("service") ?? "").trim().replace(/\\s+/g, " ").slice(0, 100),
    locale,
  );
  if (!service) return { error: "invalid_service" as const };

  const cookieStore = await cookies();
  const origin = parsePublicDirectoryNearbyValue(
    cookieStore.get(publicDirectoryNearbyCookieName(locale))?.value,
  );
  if (!origin) return { error: "location_expired" as const };

  const radius = String(Math.min(50, normalizeDirectoryRadiusKm(formData.get("radius"), 10)));
  const params = new URLSearchParams({ nearby: "1", radius, service });
  redirect(`${directoryPaths[locale].search}?${params.toString()}`);
}

/** Only a complete, unambiguous Swedish address is allowed as a search origin. */
function parseCustomerSearchAddress(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || rawValue.length > 180) return null;
  const raw = rawValue.trim().replace(/\s+/g, " ");
  const match = /^([^,]{3,120}),\s*(\d{3})\s?(\d{2})\s+([^,]{2,80})$/u.exec(raw);
  if (!match) return null;
  const addressLine1 = match[1].trim();
  const postalCode = match[2] + " " + match[3];
  const city = match[4].trim();
  if (/[<>]/u.test(addressLine1 + city) || !/[\p{L}]/u.test(city)) return null;
  return { addressLine1, postalCode, city };
}

/** Converts an officially verified address to a private, short-lived Nearby cookie. */
export async function searchPublicDirectoryAddressAction(formData: FormData) {
  const locale = publicLocale(formData.get("locale"));
  const service = normalizeDirectoryPublicServiceQuery(
    String(formData.get("service") ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    locale,
  );
  const address = parseCustomerSearchAddress(formData.get("address"));
  if (!service || !address) return { error: "invalid_address" as const };

  const allowed = await allowPublicSubmission({
    scope: "public_directory_address_search",
    requestHeaders: await headers(),
    maxAttempts: 20,
    windowSeconds: 3600,
  });
  if (!allowed) return { error: "rate_limited" as const };

  const verification = await verifyCustomerAddress(address);
  if (verification.status === "no_match") return { error: "not_found" as const };
  if (verification.status !== "matched") return { error: "unavailable" as const };

  const sql = getSql();
  if (!sql) return { error: "unavailable" as const };
  let privateCoordinates: string | null = null;
  try {
    const rows = await sql`
      select st_y(transformed.point)::float8 as latitude,
             st_x(transformed.point)::float8 as longitude
      from (
        select st_transform(
          st_setsrid(st_makepoint(${verification.easting}::float8, ${verification.northing}::float8), 3006),
          4326
        ) as point
      ) transformed
    `;
    const position = parseDirectoryCoordinates(rows[0]?.latitude, rows[0]?.longitude);
    if (position && !(position.latitude === 0 && position.longitude === 0)) {
      privateCoordinates = serializePublicDirectoryNearbyValue([position.latitude, position.longitude].join(","));
    }
  } catch {
    return { error: "unavailable" as const };
  }
  if (!privateCoordinates) return { error: "unavailable" as const };

  const cookieStore = await cookies();
  for (const cookieLocale of PUBLIC_DIRECTORY_LOCALES) {
    cookieStore.set(
      publicDirectoryNearbyCookieName(cookieLocale),
      privateCoordinates,
      publicNearbyCookieOptions(cookieLocale, PUBLIC_DIRECTORY_NEARBY_COOKIE_MAX_AGE_SECONDS),
    );
  }

  const radius = String(Math.min(50, normalizeDirectoryRadiusKm(formData.get("radius"), 10)));
  const params = new URLSearchParams({ nearby: "1", radius, service });
  redirect(directoryPaths[locale].search + "?" + params.toString());
}
