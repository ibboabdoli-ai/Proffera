import { describe, expect, it } from "vitest";
import {
  emptyRestaurantSite,
  validateRestaurantSite,
} from "./restaurant-site-schema";

const categoryId = "10729fe3-348d-4e4b-9095-413a4140ea92";
const dishId = "84b9e62e-9bfd-408d-91f9-26791bc98b5d";

describe("restaurant site content boundary", () => {
  it("keeps empty localized fields independent while the owner drafts content", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.text.heroTitle.sv = "Doni’s";
    expect(draft.text.story.sv).toBe("");
  });

  it("rejects a dish pointing to a category outside its menu", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.dishes.push({
      id: dishId,
      categoryId,
      name: "Test",
      priceOre: 12500,
      description: { sv: "", en: "" },
      image: null,
      sortOrder: 0,
      hidden: false,
      archived: false,
    });
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });

  it("accepts a menu with a valid zero price and rejects an unsafe booking scheme", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.categories.push({
      id: categoryId,
      name: { sv: "Pasta", en: "Pasta" },
      sortOrder: 0,
      hidden: false,
    });
    draft.dishes.push({
      id: dishId,
      categoryId,
      name: "Test",
      priceOre: 0,
      description: { sv: "", en: "" },
      image: null,
      sortOrder: 0,
      hidden: false,
      archived: false,
    });
    expect(validateRestaurantSite(draft).ok).toBe(true);
    draft.links.booking = "javascript:alert(1)";
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });

  it("rejects repeated opening-day records", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.hours[1].day = 0;
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });

  it.each([
    "https://www.google.com/maps/search/?api=1&query=Doni",
    "https://www.google.se/maps/place/Doni",
    "https://maps.google.com/?q=Doni",
    "https://maps.google.se/?q=Doni",
    "https://maps.app.goo.gl/example",
    "https://goo.gl/maps/example",
  ])("rejects a Google Maps URL presented as a booking link: %s", (bookingUrl) => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.links.booking = bookingUrl;
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });

  it("accepts direct HTTPS booking destinations including Google Reserve", () => {
    const direct = structuredClone(emptyRestaurantSite);
    direct.links.booking = "https://booking.example.com/donis";
    expect(validateRestaurantSite(direct).ok).toBe(true);

    const googleReserve = structuredClone(emptyRestaurantSite);
    googleReserve.links.booking =
      "https://www.google.com/maps/reserve/v/dine/c/Example";
    expect(validateRestaurantSite(googleReserve).ok).toBe(true);

    const localizedGoogleReserve = structuredClone(emptyRestaurantSite);
    localizedGoogleReserve.links.booking =
      "https://www.google.se/maps/reserve/v/dine/c/Example";
    expect(validateRestaurantSite(localizedGoogleReserve).ok).toBe(true);
  });

  it("rejects malformed HTTPS-looking links without //", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.links.booking = "https:booking.example.com/donis";
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });
});
