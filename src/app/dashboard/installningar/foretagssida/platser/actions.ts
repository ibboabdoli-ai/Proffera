"use server";

import { redirect } from "next/navigation";

import {
  businessProfileLocationGeocodePrecisions,
  businessProfileLocationVisibilities,
  createOwnerBusinessProfileLocation,
  deactivateOwnerBusinessProfileLocation,
  editableBusinessProfileLocationPurposes,
  listOwnerBusinessProfileLocations,
  updateOwnerBusinessProfileLocation,
  type BusinessProfileLocationGeocodePrecision,
  type BusinessProfileLocationVisibility,
  type EditableBusinessProfileLocationPurpose,
  type WriteBusinessProfileLocationInput,
} from "@/lib/business-profile-location-owner";

function pageUrl(input?: { updated?: string; error?: string }) {
  const query = new URLSearchParams();
  if (input?.updated) query.set("updated", input.updated);
  if (input?.error) query.set("error", input.error);
  return `/dashboard/installningar/foretagssida/platser${query.size ? `?${query}` : ""}`;
}

function readPurpose(formData: FormData): EditableBusinessProfileLocationPurpose | null {
  const purpose = String(formData.get("purpose") ?? "");
  return editableBusinessProfileLocationPurposes.includes(purpose as EditableBusinessProfileLocationPurpose)
    ? purpose as EditableBusinessProfileLocationPurpose
    : null;
}

function readVisibility(formData: FormData): BusinessProfileLocationVisibility | null {
  const visibility = String(formData.get("visibility") ?? "");
  return businessProfileLocationVisibilities.includes(visibility as BusinessProfileLocationVisibility)
    ? visibility as BusinessProfileLocationVisibility
    : null;
}

function readLocationInput(formData: FormData): WriteBusinessProfileLocationInput | null {
  const purpose = readPurpose(formData);
  const visibility = readVisibility(formData);
  if (!purpose || !visibility) return null;

  return {
    purpose,
    visibility,
    isVisitable: formData.get("isVisitable") === "on",
    isPrimary: formData.get("isPrimary") === "on",
    confirmed: formData.get("confirmed") === "on",
    addressLine1: String(formData.get("addressLine1") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    municipality: String(formData.get("municipality") ?? ""),
  };
}

function sameAddress(input: WriteBusinessProfileLocationInput, existing: {
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
}) {
  return String(input.addressLine1 ?? "").trim() === existing.addressLine1.trim()
    && String(input.postalCode ?? "").trim() === existing.postalCode.trim()
    && String(input.city ?? "").trim() === existing.city.trim()
    && String(input.municipality ?? "").trim() === existing.municipality.trim();
}

export async function createLocationAction(formData: FormData) {
  const input = readLocationInput(formData);
  if (!input) redirect(pageUrl({ error: "invalid" }));

  try {
    await createOwnerBusinessProfileLocation(input);
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "created" }));
}

export async function updateLocationAction(formData: FormData) {
  const input = readLocationInput(formData);
  const id = String(formData.get("id") ?? "").trim();
  if (!input || !id) redirect(pageUrl({ error: "invalid" }));

  let existingLocation;
  try {
    const currentLocations = await listOwnerBusinessProfileLocations();
    existingLocation = currentLocations.find(
      (location) => location.id === id && location.sourceType === "owner",
    );
  } catch {
    redirect(pageUrl({ error: "save" }));
  }

  if (!existingLocation) redirect(pageUrl({ error: "invalid" }));

  const addressUnchanged = sameAddress(input, existingLocation);
  const geocodePrecision = addressUnchanged && businessProfileLocationGeocodePrecisions.includes(
    existingLocation.geocodePrecision as BusinessProfileLocationGeocodePrecision,
  )
    ? existingLocation.geocodePrecision as BusinessProfileLocationGeocodePrecision
    : "unknown";

  try {
    await updateOwnerBusinessProfileLocation({
      ...input,
      id,
      latitude: addressUnchanged ? existingLocation.latitude : null,
      longitude: addressUnchanged ? existingLocation.longitude : null,
      geocodeSource: addressUnchanged ? existingLocation.geocodeSource : "",
      geocodePrecision,
    });
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "updated" }));
}

export async function deactivateLocationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(pageUrl({ error: "invalid" }));

  try {
    await deactivateOwnerBusinessProfileLocation(id);
  } catch {
    redirect(pageUrl({ error: "save" }));
  }
  redirect(pageUrl({ updated: "deactivated" }));
}
