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

  it("backfills business details for older saved restaurant documents", () => {
    const legacy = structuredClone(emptyRestaurantSite) as Record<string, unknown>;
    delete legacy.business;
    const result = validateRestaurantSite(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.site.business.address).toBe("Hornsbergs Strand 77");
      expect(result.site.business.email).toBe("donitrattoria@gmail.com");
    }
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

  it("rejects an invalid editable restaurant email but allows an empty one", () => {
    const invalid = structuredClone(emptyRestaurantSite);
    invalid.business.email = "not-an-email";
    expect(validateRestaurantSite(invalid).ok).toBe(false);

    const empty = structuredClone(emptyRestaurantSite);
    empty.business.email = "";
    expect(validateRestaurantSite(empty).ok).toBe(true);
  });

  it("requires a nonempty editable restaurant name", () => {
    const draft = structuredClone(emptyRestaurantSite);
    draft.business.name = "   ";
    expect(validateRestaurantSite(draft).ok).toBe(false);
  });

  it("rejects unusable phone values while allowing real and empty numbers", () => {
    const invalid = structuredClone(emptyRestaurantSite);
    invalid.business.phone = "call us";
    expect(validateRestaurantSite(invalid).ok).toBe(false);

    const valid = structuredClone(emptyRestaurantSite);
    valid.business.phone = "+46 8-656 84 00";
    expect(validateRestaurantSite(valid).ok).toBe(true);

    const empty = structuredClone(emptyRestaurantSite);
    empty.business.phone = "";
    expect(validateRestaurantSite(empty).ok).toBe(true);
  });

  it("validates Instagram handles and destinations", () => {
    const invalidHandle = structuredClone(emptyRestaurantSite);
    invalidHandle.business.instagram = "our account";
    expect(validateRestaurantSite(invalidHandle).ok).toBe(false);

    const slashHandle = structuredClone(emptyRestaurantSite);
    slashHandle.business.instagram = "foo/bar";
    expect(validateRestaurantSite(slashHandle).ok).toBe(false);

    for (const handle of [".", ".foo", "foo.", "foo..bar"]) {
      const invalidPeriods = structuredClone(emptyRestaurantSite);
      invalidPeriods.business.instagram = handle;
      invalidPeriods.business.instagramUrl = "";
      expect(validateRestaurantSite(invalidPeriods).ok).toBe(false);
    }

    const validHandle = structuredClone(emptyRestaurantSite);
    validHandle.business.instagram = "@donis.trattoria";
    expect(validateRestaurantSite(validHandle).ok).toBe(true);

    const invalidUrl = structuredClone(emptyRestaurantSite);
    invalidUrl.business.instagramUrl = "https://example.com/donis";
    expect(validateRestaurantSite(invalidUrl).ok).toBe(false);

    const malformedUrl = structuredClone(emptyRestaurantSite);
    malformedUrl.business.instagramUrl = "not-a-url";
    expect(validateRestaurantSite(malformedUrl).ok).toBe(false);

    const nonProfileUrl = structuredClone(emptyRestaurantSite);
    nonProfileUrl.business.instagramUrl =
      "https://www.instagram.com/donis.trattoria/reels/";
    expect(validateRestaurantSite(nonProfileUrl).ok).toBe(false);

    const mismatchedProfile = structuredClone(emptyRestaurantSite);
    mismatchedProfile.business.instagram = "@donis.trattoria";
    mismatchedProfile.business.instagramUrl =
      "https://www.instagram.com/another.profile/";
    expect(validateRestaurantSite(mismatchedProfile).ok).toBe(false);

    const urlWithoutHandle = structuredClone(emptyRestaurantSite);
    urlWithoutHandle.business.instagram = "";
    urlWithoutHandle.business.instagramUrl =
      "https://www.instagram.com/donis.trattoria/";
    expect(validateRestaurantSite(urlWithoutHandle).ok).toBe(false);

    const handleWithoutUrl = structuredClone(emptyRestaurantSite);
    handleWithoutUrl.business.instagram = "@donis.trattoria";
    handleWithoutUrl.business.instagramUrl = "";
    expect(validateRestaurantSite(handleWithoutUrl).ok).toBe(true);

    const validUrl = structuredClone(emptyRestaurantSite);
    validUrl.business.instagramUrl = "https://www.instagram.com/donis.trattoria/";
    expect(validateRestaurantSite(validUrl).ok).toBe(true);

    const caseInsensitiveMatch = structuredClone(emptyRestaurantSite);
    caseInsensitiveMatch.business.instagram = "@Donis.Trattoria";
    caseInsensitiveMatch.business.instagramUrl =
      "https://instagram.com/donis.trattoria/";
    expect(validateRestaurantSite(caseInsensitiveMatch).ok).toBe(true);
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
