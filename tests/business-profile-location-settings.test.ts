import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOwnerBusinessProfileLocation: vi.fn(),
  deactivateOwnerBusinessProfileLocation: vi.fn(),
  listOwnerBusinessProfileLocations: vi.fn(),
  updateOwnerBusinessProfileLocation: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/business-profile-location-owner", () => ({
  businessProfileLocationGeocodePrecisions: ["unknown", "postal_code", "street", "address", "rooftop"],
  businessProfileLocationVisibilities: ["private", "approximate", "public"],
  editableBusinessProfileLocationPurposes: ["workplace", "storefront", "service_base"],
  createOwnerBusinessProfileLocation: mocks.createOwnerBusinessProfileLocation,
  deactivateOwnerBusinessProfileLocation: mocks.deactivateOwnerBusinessProfileLocation,
  listOwnerBusinessProfileLocations: mocks.listOwnerBusinessProfileLocations,
  updateOwnerBusinessProfileLocation: mocks.updateOwnerBusinessProfileLocation,
}));

import { updateLocationAction } from "@/app/dashboard/installningar/foretagssida/platser/actions";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function ownerLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    profileId: "22222222-2222-4222-8222-222222222222",
    purpose: "workplace",
    visibility: "public",
    isVisitable: true,
    isPrimary: true,
    sourceType: "owner",
    addressLine1: "Storgatan 1",
    postalCode: "151 71",
    city: "Södertälje",
    municipality: "Södertälje",
    latitude: 59.1955,
    longitude: 17.6253,
    geocodeSource: "lantmateriet",
    geocodePrecision: "rooftop",
    confirmedAt: "2026-08-24T10:00:00.000Z",
    ...overrides,
  };
}

function updateForm(overrides: Record<string, string | boolean> = {}) {
  const values: Record<string, string | boolean> = {
    id: "11111111-1111-4111-8111-111111111111",
    purpose: "workplace",
    visibility: "public",
    isVisitable: true,
    isPrimary: true,
    confirmed: true,
    addressLine1: "Storgatan 1",
    postalCode: "151 71",
    city: "Södertälje",
    municipality: "Södertälje",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("Business Profile location settings wiring", () => {
  const page = source("src/app/dashboard/installningar/foretagssida/platser/page.tsx");
  const companyPage = source("src/app/dashboard/installningar/foretagssida/page.tsx");

  beforeEach(() => {
    mocks.createOwnerBusinessProfileLocation.mockReset();
    mocks.deactivateOwnerBusinessProfileLocation.mockReset();
    mocks.listOwnerBusinessProfileLocations.mockReset();
    mocks.updateOwnerBusinessProfileLocation.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });
    mocks.updateOwnerBusinessProfileLocation.mockResolvedValue(undefined);
  });

  it("preserves server-owned geocoding for an unchanged address and ignores client workspace input", async () => {
    mocks.listOwnerBusinessProfileLocations.mockResolvedValue([ownerLocation()]);
    const formData = updateForm();
    formData.set("workspaceId", "33333333-3333-4333-8333-333333333333");

    await expect(updateLocationAction(formData)).rejects.toThrow("updated=updated");

    expect(mocks.updateOwnerBusinessProfileLocation).toHaveBeenCalledTimes(1);
    expect(mocks.updateOwnerBusinessProfileLocation).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      purpose: "workplace",
      visibility: "public",
      isVisitable: true,
      isPrimary: true,
      confirmed: true,
      addressLine1: "Storgatan 1",
      postalCode: "151 71",
      city: "Södertälje",
      municipality: "Södertälje",
      latitude: 59.1955,
      longitude: 17.6253,
      geocodeSource: "lantmateriet",
      geocodePrecision: "rooftop",
    });
    expect(mocks.updateOwnerBusinessProfileLocation.mock.calls[0]?.[0]).not.toHaveProperty("workspaceId");
  });

  it("clears stale geocoding when the address changes", async () => {
    mocks.listOwnerBusinessProfileLocations.mockResolvedValue([ownerLocation()]);

    await expect(updateLocationAction(updateForm({ addressLine1: "Nyvägen 2" }))).rejects.toThrow("updated=updated");

    expect(mocks.updateOwnerBusinessProfileLocation).toHaveBeenCalledWith(expect.objectContaining({
      addressLine1: "Nyvägen 2",
      latitude: null,
      longitude: null,
      geocodeSource: "",
      geocodePrecision: "unknown",
    }));
  });

  it("keeps coordinates but downgrades unsupported stored precision", async () => {
    mocks.listOwnerBusinessProfileLocations.mockResolvedValue([
      ownerLocation({ geocodePrecision: "parcel" }),
    ]);

    await expect(updateLocationAction(updateForm())).rejects.toThrow("updated=updated");

    expect(mocks.updateOwnerBusinessProfileLocation).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 59.1955,
      longitude: 17.6253,
      geocodeSource: "lantmateriet",
      geocodePrecision: "unknown",
    }));
  });

  it("rejects a row outside the owner-scoped editable boundary without converting invalid to save", async () => {
    mocks.listOwnerBusinessProfileLocations.mockResolvedValue([
      ownerLocation({ sourceType: "scb" }),
    ]);

    await expect(updateLocationAction(updateForm())).rejects.toThrow("error=invalid");

    expect(mocks.updateOwnerBusinessProfileLocation).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(String(mocks.redirect.mock.calls[0]?.[0])).toContain("error=invalid");
  });

  it("maps owner-location read failures to the save error path", async () => {
    mocks.listOwnerBusinessProfileLocations.mockRejectedValue(new Error("database unavailable"));

    await expect(updateLocationAction(updateForm())).rejects.toThrow("error=save");

    expect(mocks.updateOwnerBusinessProfileLocation).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(String(mocks.redirect.mock.calls[0]?.[0])).toContain("error=save");
  });

  it("keeps publication state explicit and does not expose coordinate editing", () => {
    expect(page).toContain('name="isVisitable"');
    expect(page).toContain('name="isPrimary"');
    expect(page).toContain('name="confirmed"');
    expect(page).toContain('name="visibility"');
    expect(page).toContain('<option value="public">Publik</option>');
    expect(page).not.toContain('name="latitude"');
    expect(page).not.toContain('name="longitude"');
    expect(page).toContain("Exakta kartkoordinater hanteras inte på den här sidan");
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
