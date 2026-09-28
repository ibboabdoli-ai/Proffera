import { describe, expect, it } from "vitest";

import {
  DONIS_FALLBACK_IMAGES,
  DONIS_FALLBACK_SITE,
} from "../src/lib/donis-fallback";
import { validateRestaurantSite } from "../src/lib/restaurant-site-schema";

describe("Doni public fallback", () => {
  it("is valid restaurant content without inventing menu prices", () => {
    expect(validateRestaurantSite(DONIS_FALLBACK_SITE).ok).toBe(true);
    expect(DONIS_FALLBACK_SITE.dishes.length).toBeGreaterThan(4);
    expect(DONIS_FALLBACK_SITE.dishes.every((dish) => dish.priceOre === null)).toBe(
      true,
    );
  });

  it("ships real-looking sample imagery and confirmed opening hours", () => {
    expect(Object.keys(DONIS_FALLBACK_IMAGES).length).toBeGreaterThanOrEqual(8);
    expect(DONIS_FALLBACK_SITE.media.gallery.length).toBeGreaterThanOrEqual(3);
    expect(DONIS_FALLBACK_SITE.hours.map((item) => [item.open, item.close])).toEqual([
      ["10:30", "21:00"],
      ["10:30", "21:00"],
      ["10:30", "21:00"],
      ["10:30", "21:00"],
      ["10:30", "22:00"],
      ["12:00", "22:00"],
      ["12:00", "21:00"],
    ]);
  });
});
