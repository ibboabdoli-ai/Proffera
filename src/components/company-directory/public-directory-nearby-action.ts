"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  directoryPaths,
  normalizeDirectoryPublicServiceQuery,
} from "@/components/company-directory/public-directory-copy";
import { normalizeDirectoryRadiusKm } from "@/lib/company-directory-distance";
import type { PublicLocale } from "@/lib/public-locale";
import {
  publicDirectoryNearbyCookieName,
  publicDirectoryNearbyCookiePath,
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
  const radius = String(normalizeDirectoryRadiusKm(formData.get("radius"), 25));
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
