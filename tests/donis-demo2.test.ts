import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni demo 2", () => {
  it("is a separate noindex route using the same published restaurant source", () => {
    const page = readFileSync(
      "src/app/demo/donis-trattoria2/page.tsx",
      "utf8",
    );

    expect(page).toContain("getPublishedRestaurantSite()");
    expect(page).toContain("projectPublicRestaurantSite");
    expect(page).toContain("getRestaurantImageUrls(site)");
    expect(page).toContain("robots: { index: false, follow: false }");
    expect(page).toContain("/demo/donis-trattoria2");
  });

  it("uses a distinct premium dark visual system and a Doni-specific real-menu fallback", () => {
    const source = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );
    const fallback = readFileSync(
      "src/lib/donis-luxury-fallback.ts",
      "utf8",
    );

    expect(source).toContain('bg-[#080a08]');
    expect(source).toContain('text-[#d6aa58]');
    expect(source).toContain("DONIS_LUXURY_FALLBACK_SITE");
    expect(source).toContain("DONIS_LUXURY_FALLBACK_IMAGES");
    expect(source).toContain("dish.priceOre === null");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("document.documentElement.lang = lang");
    expect(source).not.toContain("currentOrderUrl");
    expect(source).toContain("const order = displaySite.links.order");
    expect(source).toContain("mapEmbedUrl");
    expect(source).not.toContain("DONIS_GENERATED_MENU_TILE_BY_IMAGE_ID");
    expect(source).not.toContain('backgroundSize: "400% 400%"');

    expect(fallback).toContain("Tagliatelle al ragu");
    expect(fallback).toContain("Spaghetti con scampi e zucchini");
    expect(fallback).toContain("Napolitana surdegspizza");
    expect(fallback).toContain("Romana surdegspizza");
    expect(fallback).toContain("Aperol spritz");
    expect(fallback).toContain("imageproxy.wolt.com");
    expect(fallback).toContain("images.pexels.com");
    expect(fallback).toContain("pexelsPhoto(20150374)");
    expect(fallback).toContain("pexelsPhoto(6542787)");
    expect(fallback).toContain("pexelsPhoto(36791051)");
    expect(fallback).toContain("pexelsPhoto(4915835)");
    const pexelsPhotoIds = [...fallback.matchAll(/pexelsPhoto\((\d+)\)/g)].map(
      (match) => match[1],
    );
    expect(pexelsPhotoIds.length).toBeGreaterThanOrEqual(30);
    expect(new Set(pexelsPhotoIds).size).toBeGreaterThanOrEqual(30);
    expect(fallback).not.toContain("DONIS_GENERATED_MENU_SPRITE");
    expect(fallback).not.toContain("DONIS_GENERATED_MENU_IMAGE_IDS");

    expect(source).toContain('"oliver": "Olives"');
    expect(source).toContain('"vitlöksbröd": "Garlic Bread"');
    expect(source).toContain('"lemonad": "Lemonade"');
    expect(source).toContain('"loka citron 33cl": "Loka Lemon 33cl"');
    expect(source).toContain("getDishName(dish, lang)");
    expect(source).toMatch(/isFallback &&\s+fallbackContactMedia/);
    expect(source).toMatch(/isFallback &&\s+fallbackAboutMedia/);
    expect(source).toContain('aboutCta: "Se restaurangen"');
    expect(source).toContain('aboutCta: "Explore the restaurant"');
    expect(source).toContain(
      'href={galleryVisuals.length > 0 ? "#galleri" : "#meny"}',
    );
    expect(source).toContain("const contactImage =");
    expect(source).toContain("contactImage.url");
    expect(source).toContain("rawGallery.length >= 9");
    expect(source).toContain("? rawGallery");
    expect(source).toContain(": [...rawGallery, ...dishGallery].slice(0, 9)");


    expect(fallback).toContain("Efter ägarbytet");
    expect(fallback).toContain("Following a change of ownership");
    expect(fallback).toContain('"/donis/about-interior.webp"');
    expect(fallback).toContain('"/donis/contact-exterior.webp"');
    expect(fallback).toContain("imageIds.aboutInterior");
    expect(fallback).toContain("imageIds.contactExterior");
    expect(existsSync("public/donis/about-interior.webp")).toBe(true);
    expect(existsSync("public/donis/contact-exterior.webp")).toBe(true);
  });

  it("keeps the existing Doni demo and its shared fallback untouched", () => {
    const firstDemo = readFileSync(
      "src/app/demo/donis-trattoria/page.tsx",
      "utf8",
    );
    const secondDemo = readFileSync(
      "src/app/demo/donis-trattoria2/page.tsx",
      "utf8",
    );
    const firstDemoInteractions = readFileSync(
      "src/app/demo/donis-trattoria/demo-interactions.tsx",
      "utf8",
    );

    expect(firstDemo).toContain("./demo-interactions");
    expect(secondDemo).toContain("./demo-interactions");
    expect(firstDemo).toContain("Doni’s Trattoria | Stockholm");
    expect(secondDemo).toContain("generateMetadata");
    expect(secondDemo).toContain("const title = business.city");
    expect(secondDemo).toContain("applicationName: name");
    expect(firstDemoInteractions).toContain("DONIS_FALLBACK_SITE");
    expect(firstDemoInteractions).not.toContain("DONIS_LUXURY_FALLBACK_SITE");
  });
});
