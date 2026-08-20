import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NearbySearchFields } from "@/app/admin/foretag/directory/search-preview/NearbySearchFields";
import {
  applyAdminCurrentPosition,
  applyAdminManualCoordinateEdit,
  buildAdminNearbySearchDestination,
  parseAdminNearbyCoordinatePair,
  parseAdminNearbyCoordinates,
  resolveAdminDirectorySearchMode,
} from "@/app/admin/foretag/directory/search-preview/search-behavior";

const TEST_SERVER_ACTION = "/admin/test-nearby" as unknown as (formData: FormData) => Promise<void>;

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

  it("requires a complete finite in-range coordinate pair", () => {
    expect(parseAdminNearbyCoordinatePair("59.1955", "17.6253")).toEqual({
      latitude: "59.195500",
      longitude: "17.625300",
    });
    expect(parseAdminNearbyCoordinatePair("59.1955", "")).toBeNull();
    expect(parseAdminNearbyCoordinatePair("", "17.6253")).toBeNull();
    expect(parseAdminNearbyCoordinatePair("north", "17.6253")).toBeNull();
    expect(parseAdminNearbyCoordinatePair("91", "17.6253")).toBeNull();
    expect(parseAdminNearbyCoordinatePair("59.1955", "181")).toBeNull();
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

  it("renders only the combined coordinate submit control for Nearby", () => {
    const html = renderToStaticMarkup(
      createElement(
        "form",
        null,
        createElement(NearbySearchFields, {
          defaultLatitude: "59.1955",
          defaultLongitude: "17.6253",
          defaultRadius: "999",
          available: true,
          searchNearbyAction: TEST_SERVER_ACTION,
        }),
      ),
    );

    expect(html).toContain('name="nearbyCoordinates"');
    expect(html).toContain('value="59.195500,17.625300"');
    expect(html).not.toContain('name="latitude"');
    expect(html).not.toContain('name="longitude"');
    expect(html).toContain('value="25" selected=""');
  });

  it("renders Nearby submit disabled for an invalid coordinate pair", () => {
    const html = renderToStaticMarkup(
      createElement(
        "form",
        null,
        createElement(NearbySearchFields, {
          defaultLatitude: "91",
          defaultLongitude: "17.6253",
          available: true,
          searchNearbyAction: TEST_SERVER_ACTION,
        }),
      ),
    );

    expect(html).toContain('name="nearbyCoordinates"');
    expect(html).toContain('value=""');
    expect(html).toContain('disabled=""');
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

  it("rejects partial or invalid coordinates instead of entering nearby mode", () => {
    expect(resolveAdminDirectorySearchMode({
      location: "",
      latitude: "59.195500",
      longitude: "",
    })).toEqual({
      location: "",
      latitude: undefined,
      longitude: undefined,
    });
    expect(resolveAdminDirectorySearchMode({
      location: "",
      latitude: "91",
      longitude: "17.625300",
    })).toEqual({
      location: "",
      latitude: undefined,
      longitude: undefined,
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
