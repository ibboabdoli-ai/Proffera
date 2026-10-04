import { readFileSync } from "node:fs";
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
    expect(source).toContain("currentOrderUrl");
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
    expect(fallback).not.toContain("DONIS_GENERATED_MENU_SPRITE");
    expect(fallback).not.toContain("DONIS_GENERATED_MENU_IMAGE_IDS");
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
    expect(secondDemo).toContain("Doni’s Trattoria | Premium concept");
    expect(firstDemoInteractions).toContain("DONIS_FALLBACK_SITE");
    expect(firstDemoInteractions).not.toContain("DONIS_LUXURY_FALLBACK_SITE");
  });
});
