import { describe, expect, it } from "vitest";

import {
  applyAdminCurrentPosition,
  applyAdminManualCoordinateEdit,
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
