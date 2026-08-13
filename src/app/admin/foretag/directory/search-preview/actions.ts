"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { geocodeDirectoryPilotFromAdmin } from "@/lib/company-directory-geocoding";

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
