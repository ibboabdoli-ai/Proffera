import { describe, expect, it } from "vitest";

import {
  calculateDirectoryDistanceKm,
  normalizeDirectoryRadiusKm,
  parseDirectoryCoordinates,
} from "./company-directory-distance";

describe("company directory nearby helpers", () => {
  it("accepts valid coordinates and rejects incomplete or out-of-range values", () => {
    expect(parseDirectoryCoordinates("59.3293", "18.0686")).toEqual({
      latitude: 59.3293,
      longitude: 18.0686,
    });
    expect(parseDirectoryCoordinates("59.3293", "")).toBeNull();
    expect(parseDirectoryCoordinates("91", "18")).toBeNull();
    expect(parseDirectoryCoordinates("59", "181")).toBeNull();
  });

  it("bounds nearby radius to a safe pilot range", () => {
    expect(normalizeDirectoryRadiusKm("25")).toBe(25);
    expect(normalizeDirectoryRadiusKm("0")).toBe(1);
    expect(normalizeDirectoryRadiusKm("500")).toBe(100);
    expect(normalizeDirectoryRadiusKm("bad", 20)).toBe(20);
  });

  it("calculates zero distance for the same point", () => {
    const point = { latitude: 59.3293, longitude: 18.0686 };
    expect(calculateDirectoryDistanceKm(point, point)).toBeCloseTo(0, 8);
  });

  it("calculates a realistic Stockholm to Södertälje straight-line distance", () => {
    const stockholm = { latitude: 59.3293, longitude: 18.0686 };
    const sodertalje = { latitude: 59.1955, longitude: 17.6253 };
    const distance = calculateDirectoryDistanceKm(stockholm, sodertalje);
    expect(distance).toBeGreaterThan(25);
    expect(distance).toBeLessThan(35);
  });
});
