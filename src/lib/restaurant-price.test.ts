import { describe, expect, it } from "vitest";
import { parseRestaurantPrice } from "./restaurant-price";

describe("quick restaurant price edit", () => {
  it("keeps a trailing decimal separator while the owner types", () => {
    expect(parseRestaurantPrice("12.")).toBe(1200);
    expect(parseRestaurantPrice("12.50")).toBe(1250);
    expect(parseRestaurantPrice("12,50")).toBe(1250);
  });

  it("distinguishes cleared, zero and invalid prices", () => {
    expect(parseRestaurantPrice("")).toBeNull();
    expect(parseRestaurantPrice("0")).toBe(0);
    expect(parseRestaurantPrice("12.345")).toBeUndefined();
  });
});
