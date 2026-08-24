import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Business Profile location settings wiring", () => {
  const page = source("src/app/dashboard/installningar/foretagssida/platser/page.tsx");
  const companyPage = source("src/app/dashboard/installningar/foretagssida/page.tsx");

  it("routes all mutations through the existing owner-scoped location boundary", () => {
    expect(page).toContain("listOwnerBusinessProfileLocations()");
    expect(page).toContain("createOwnerBusinessProfileLocation(input)");
    expect(page).toContain("updateOwnerBusinessProfileLocation({");
    expect(page).toContain("deactivateOwnerBusinessProfileLocation(id)");
    expect(page).not.toContain('from "@/lib/db/server"');
    expect(page).not.toContain("workspaceId");
  });

  it("keeps publication state explicit and does not expose coordinate editing", () => {
    expect(page).toContain('formData.get("isVisitable") === "on"');
    expect(page).toContain('formData.get("isPrimary") === "on"');
    expect(page).toContain('formData.get("confirmed") === "on"');
    expect(page).toContain('name="visibility"');
    expect(page).toContain('<option value="public">Publik</option>');
    expect(page).not.toContain('name="latitude"');
    expect(page).not.toContain('name="longitude"');
    expect(page).toContain("Exakta kartkoordinater hanteras inte på den här sidan");
  });

  it("preserves server-owned geocoding metadata when the edit form does not expose it", () => {
    expect(page).toContain("const currentLocations = await listOwnerBusinessProfileLocations()");
    expect(page).toContain('location.id === id && location.sourceType === "owner"');
    expect(page).toContain("latitude: existingLocation.latitude");
    expect(page).toContain("longitude: existingLocation.longitude");
    expect(page).toContain("geocodeSource: existingLocation.geocodeSource");
    expect(page).toContain("businessProfileLocationGeocodePrecisions.includes");
    expect(page).toContain("geocodePrecision,");
  });

  it("renders non-owner source rows read-only and exposes edit controls only for owner rows", () => {
    expect(page).toContain('location.sourceType === "owner"');
    expect(page).toContain("editableBusinessProfileLocationPurposes.includes");
    expect(page).toContain("Skrivskyddade platser");
    expect(page).toContain("kan inte ändras från företagets platsinställningar");
    expect(page).toContain('action={updateLocationAction}');
    expect(page).toContain('action={deactivateLocationAction}');
  });

  it("links the existing company-page settings surface to the location manager", () => {
    expect(companyPage).toContain('href="/dashboard/installningar/foretagssida/platser"');
    expect(companyPage).toContain("Hantera företagsplatser");
  });
});
