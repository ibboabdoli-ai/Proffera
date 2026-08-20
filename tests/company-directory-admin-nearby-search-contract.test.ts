import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyAdminCurrentPosition,
  applyAdminManualCoordinateEdit,
  buildAdminNearbySearchDestination,
  parseAdminNearbyCoordinates,
  resolveAdminDirectorySearchMode,
} from "@/app/admin/foretag/directory/search-preview/search-behavior";

describe("admin directory nearby search behavior", () => {
  it("clears a stale manual location when current position succeeds", () => {
    const manualLocation = { value: "Stockholm" };

    const result = applyAdminCurrentPosition(
      {
        coords: {
          latitude: 59.1955,
          longitude: 17.6253,
        },
      },
      manualLocation,
    );

    expect(manualLocation.value).toBe("");
    expect(result).toEqual({
      latitude: "59.195500",
      longitude: "17.625300",
      status: "Position hämtad. Platsfältet är rensat. Tryck Sök.",
    });
  });

  it("clears the manual city when raw nearby coordinates are edited", () => {
    const manualLocation = { value: "Stockholm" };
    const latitude = applyAdminManualCoordinateEdit("59.195500", manualLocation);
    const longitude = applyAdminManualCoordinateEdit("17.625300", manualLocation);

    expect(manualLocation.value).toBe("");
    expect(resolveAdminDirectorySearchMode({
      location: manualLocation.value,
      latitude,
      longitude,
    })).toEqual({
      location: "",
      latitude: "59.195500",
      longitude: "17.625300",
    });
  });

  it("validates the coordinate value used by the nearby POST action", () => {
    expect(parseAdminNearbyCoordinates("59.1955,17.6253")).toEqual({
      latitude: "59.195500",
      longitude: "17.625300",
    });
    expect(parseAdminNearbyCoordinates("91,17.6253")).toBeNull();
    expect(parseAdminNearbyCoordinates("59.1955,181")).toBeNull();
    expect(parseAdminNearbyCoordinates("not-a-position")).toBeNull();
  });

  it("builds the nearby redirect without latitude or longitude query parameters", () => {
    const destination = buildAdminNearbySearchDestination({
      service: "Elektriker",
      radius: "25",
    });

    expect(destination).toContain("nearby=1");
    expect(destination).toContain("service=Elektriker");
    expect(destination).toContain("radius=25");
    expect(destination).not.toContain("latitude");
    expect(destination).not.toContain("longitude");
  });

  it("does not serialize raw coordinate inputs through the surrounding GET form", () => {
    const source = readFileSync(
      "src/app/admin/foretag/directory/search-preview/NearbySearchFields.tsx",
      "utf8",
    );

    expect(source).not.toContain('name="latitude"');
    expect(source).not.toContain('name="longitude"');
    expect(source).toContain('name="nearbyCoordinates"');
    expect(source).toContain("formAction={searchNearbyAction}");
  });

  it("lets a manual location win over stale nearby coordinates", () => {
    expect(resolveAdminDirectorySearchMode({
      location: "Södertälje",
      latitude: "59.195500",
      longitude: "17.625300",
    })).toEqual({
      location: "Södertälje",
      latitude: undefined,
      longitude: undefined,
    });
  });

  it("preserves an explicitly blank nationwide location search", () => {
    expect(resolveAdminDirectorySearchMode({ location: "" })).toEqual({
      location: "",
      latitude: undefined,
      longitude: undefined,
    });
  });

  it("uses nearby coordinates when the manual location is blank", () => {
    expect(resolveAdminDirectorySearchMode({
      location: "",
      latitude: "59.195500",
      longitude: "17.625300",
    })).toEqual({
      location: "",
      latitude: "59.195500",
      longitude: "17.625300",
    });
  });

  it("keeps Stockholm only as the untouched initial default", () => {
    expect(resolveAdminDirectorySearchMode({})).toEqual({
      location: "Stockholm",
      latitude: undefined,
      longitude: undefined,
    });
  });
});
