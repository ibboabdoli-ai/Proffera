"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { geocodeDirectoryPilotFromAdmin } from "@/lib/company-directory-geocoding";
import {
  ADMIN_DIRECTORY_NEARBY_COOKIE,
  buildAdminNearbySearchDestination,
  parseAdminNearbyCoordinates,
} from "./search-behavior";

export async function geocodeDirectoryPilotAction() {
  let destination = "/admin/foretag/directory/search-preview?geocode=failed";

  try {
    const result = await geocodeDirectoryPilotFromAdmin(5);
    revalidatePath("/admin/foretag/directory/search-preview");
    const params = new URLSearchParams({
      geocode: "done",
      attempted: String(result.attempted),
      geocoded: String(result.geocoded),
      noMatch: String(result.noMatch),
      errors: String(result.errors),
      remaining: String(result.remaining),
      needsReview: String(result.needsReview),
    });
    destination = `/admin/foretag/directory/search-preview?${params.toString()}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocoding failed";
    const code = message.includes("not configured")
      ? "not_configured"
      : message.includes("PostGIS")
        ? "postgis_missing"
        : "failed";
    destination = `/admin/foretag/directory/search-preview?geocode=${code}`;
  }

  redirect(destination);
}

/** Stores a validated Nearby position briefly and redirects without exposing coordinates in the URL. */
export async function searchDirectoryNearbyAction(formData: FormData) {
  await requireSuperAdmin();

  const coordinates = parseAdminNearbyCoordinates(String(formData.get("nearbyCoordinates") ?? ""));
  const destination = buildAdminNearbySearchDestination({
    service: String(formData.get("service") ?? ""),
    radius: String(formData.get("radius") ?? "25"),
  });
  const cookieStore = await cookies();

  if (!coordinates) {
    cookieStore.delete(ADMIN_DIRECTORY_NEARBY_COOKIE);
    redirect(destination);
  }

  cookieStore.set(
    ADMIN_DIRECTORY_NEARBY_COOKIE,
    `${coordinates.latitude},${coordinates.longitude}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 300,
      path: "/admin/foretag/directory/search-preview",
    },
  );

  redirect(destination);
}
