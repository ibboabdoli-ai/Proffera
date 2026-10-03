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

  it("uses a distinct premium dark visual system and data-grounded pricing", () => {
    const source = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );

    expect(source).toContain('bg-[#080a08]');
    expect(source).toContain('text-[#d6aa58]');
    expect(source).toContain("KNOWN_DEMO_PRICES_ORE");
    expect(source).toContain("dish.priceOre ??");
    expect(source).toContain("DONIS_FALLBACK_SITE");
    expect(source).toContain("DONIS_FALLBACK_IMAGES");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("document.documentElement.lang = lang");
    expect(source).toContain("currentOrderUrl");
    expect(source).toContain("mapEmbedUrl");
  });

  it("keeps the existing Doni demo untouched as a separate customer choice", () => {
    const firstDemo = readFileSync(
      "src/app/demo/donis-trattoria/page.tsx",
      "utf8",
    );
    const secondDemo = readFileSync(
      "src/app/demo/donis-trattoria2/page.tsx",
      "utf8",
    );

    expect(firstDemo).toContain("./demo-interactions");
    expect(secondDemo).toContain("./demo-interactions");
    expect(firstDemo).toContain("Doni’s Trattoria | Stockholm");
    expect(secondDemo).toContain("Doni’s Trattoria | Premium concept");
  });
});
