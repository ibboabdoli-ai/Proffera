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

  it("uses a distinct dark luxury visual system without inventing menu prices", () => {
    const source = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );

    expect(source).toContain('bg-[#090909]');
    expect(source).toContain('text-[#d4a35f]');
    expect(source).toContain("formatPrice(dish.priceOre)");
    expect(source).toContain("dish.priceOre !== null");
    expect(source).toContain("DONIS_FALLBACK_SITE");
    expect(source).toContain("DONIS_FALLBACK_IMAGES");
    expect(source).toContain("IntersectionObserver");
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
    expect(secondDemo).toContain("Doni’s Trattoria | Dark concept");
  });
});
