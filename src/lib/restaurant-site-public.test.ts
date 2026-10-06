import { describe, expect, it } from "vitest";

import { emptyRestaurantSite } from "./restaurant-site-schema";
import { projectPublicRestaurantSite } from "./restaurant-site-public";

const visibleCategoryId = "10729fe3-348d-4e4b-9095-413a4140ea92";
const hiddenCategoryId = "e4b45a8c-73c0-4f16-9b30-11910a692c31";
const visibleDishId = "84b9e62e-9bfd-408d-91f9-26791bc98b5d";
const hiddenDishId = "af51dbbf-8b2b-4693-834f-685b0dc24ee7";
const unpricedDishId = "b2aabfac-907d-4a21-9fa1-203620b1c59b";
const hiddenCategoryDishId = "e0f4269d-4c4f-4f14-bc0d-5b69a9d2e3d7";
const visibleImageId = "5a913e72-314e-46fe-8df1-8e49eb3f7a67";
const hiddenImageId = "30b51ab6-2707-4a60-bf18-0ea4af24fa63";
const galleryImageId = "95022059-a7ab-41de-9abe-a987ed78bef1";

describe("public restaurant projection", () => {
  it("removes hidden categories and hidden or archived dishes before the client boundary", () => {
    const site = structuredClone(emptyRestaurantSite);
    site.categories = [
      {
        id: visibleCategoryId,
        name: { sv: "Pasta", en: "Pasta" },
        sortOrder: 0,
        hidden: false,
      },
      {
        id: hiddenCategoryId,
        name: { sv: "Hemlig", en: "Hidden" },
        sortOrder: 1,
        hidden: true,
      },
    ];
    site.dishes = [
      {
        id: visibleDishId,
        categoryId: visibleCategoryId,
        name: "Visible",
        priceOre: 12500,
        description: { sv: "", en: "" },
        image: { id: visibleImageId, alt: { sv: "Synlig", en: "Visible" } },
        sortOrder: 0,
        hidden: false,
        archived: false,
      },
      {
        id: unpricedDishId,
        categoryId: visibleCategoryId,
        name: "Visible without price",
        priceOre: null,
        description: { sv: "", en: "" },
        image: null,
        sortOrder: 1,
        hidden: false,
        archived: false,
      },
      {
        id: hiddenDishId,
        categoryId: visibleCategoryId,
        name: "Hidden",
        priceOre: 13500,
        description: { sv: "", en: "" },
        image: { id: hiddenImageId, alt: { sv: "Dold", en: "Hidden" } },
        sortOrder: 1,
        hidden: true,
        archived: false,
      },
      {
        id: hiddenCategoryDishId,
        categoryId: hiddenCategoryId,
        name: "Hidden category dish",
        priceOre: 14500,
        description: { sv: "", en: "" },
        image: null,
        sortOrder: 0,
        hidden: false,
        archived: false,
      },
    ];
    site.media.gallery = [
      {
        id: hiddenImageId,
        alt: { sv: "Dold rätt", en: "Hidden dish" },
        kind: "food",
        sortOrder: 0,
      },
      {
        id: galleryImageId,
        alt: { sv: "Restaurang", en: "Restaurant" },
        kind: "interior",
        sortOrder: 1,
      },
    ];

    const projected = projectPublicRestaurantSite(site);

    expect(projected.categories.map((category) => category.id)).toEqual([
      visibleCategoryId,
    ]);
    expect(projected.dishes.map((dish) => dish.id)).toEqual([
      visibleDishId,
      unpricedDishId,
    ]);
    expect(projected.media.gallery.map((item) => item.id)).toEqual([
      galleryImageId,
    ]);
  });
});
