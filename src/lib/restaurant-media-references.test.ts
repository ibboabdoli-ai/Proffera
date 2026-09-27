import { describe, expect, it } from "vitest";

import { restaurantSnapshotReferencesMedia } from "./restaurant-media-references";

describe("restaurant media references", () => {
  it("finds media used by draft or published restaurant content shapes", () => {
    expect(
      restaurantSnapshotReferencesMedia(
        {
          media: {
            hero: { id: "hero-id" },
            owner: null,
            family: null,
            gallery: [{ id: "gallery-id" }],
          },
          dishes: [{ image: { id: "dish-id" } }],
        },
        "hero-id",
      ),
    ).toBe(true);

    expect(
      restaurantSnapshotReferencesMedia(
        {
          media: {
            hero: null,
            owner: null,
            family: null,
            gallery: [{ id: "gallery-id" }],
          },
          dishes: [{ image: { id: "dish-id" } }],
        },
        "gallery-id",
      ),
    ).toBe(true);

    expect(
      restaurantSnapshotReferencesMedia(
        {
          media: {
            hero: null,
            owner: null,
            family: null,
            gallery: [],
          },
          dishes: [{ image: { id: "dish-id" } }],
        },
        "dish-id",
      ),
    ).toBe(true);
  });

  it("does not match unrelated ids or arbitrary content", () => {
    expect(
      restaurantSnapshotReferencesMedia(
        {
          media: { hero: null, owner: null, family: null, gallery: [] },
          dishes: [],
          text: { story: "dish-id" },
        },
        "dish-id",
      ),
    ).toBe(false);

    expect(restaurantSnapshotReferencesMedia(null, "dish-id")).toBe(false);
  });
});
