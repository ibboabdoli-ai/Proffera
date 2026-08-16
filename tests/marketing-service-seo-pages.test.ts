import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isMarketingServiceSlug,
  marketingServicePages,
  marketingServiceSlugs,
} from "../src/lib/marketing-service-pages";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing service SEO pages", () => {
  it("keeps the first Swedish SEO cluster intentionally small and explicit", () => {
    expect(marketingServiceSlugs).toEqual([
      "bokningssystem",
      "crm",
      "offertsystem",
      "leadhantering",
    ]);
    expect(isMarketingServiceSlug("bokningssystem")).toBe(true);
    expect(isMarketingServiceSlug("stockholm-bokningssystem")).toBe(false);
  });

  it("gives every page unique search-facing metadata and substantial content", () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const slug of marketingServiceSlugs) {
      const page = marketingServicePages[slug];
      expect(page.slug).toBe(slug);
      expect(page.title.length).toBeGreaterThan(30);
      expect(page.description.length).toBeGreaterThan(90);
      expect(page.intro.length).toBeGreaterThan(120);
      expect(page.problems).toHaveLength(3);
      expect(page.flow).toHaveLength(4);
      expect(page.features).toHaveLength(4);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      titles.add(page.title);
      descriptions.add(page.description);
    }

    expect(titles.size).toBe(marketingServiceSlugs.length);
    expect(descriptions.size).toBe(marketingServiceSlugs.length);
  });

  it("links the service cluster from the main features page and includes it in the sitemap", () => {
    const servicesPage = source("src/app/tjanster/page.tsx");
    const sitemap = source("src/app/sitemap.ts");
    const route = source("src/app/tjanster/[slug]/page.tsx");

    expect(servicesPage).toContain("marketingServicePages");
    expect(servicesPage).toContain("/tjanster/${page.slug}");
    expect(sitemap).toContain("marketingServiceSlugs");
    expect(sitemap).toContain("/tjanster/${slug}");
    expect(route).toContain("generateStaticParams");
    expect(route).toContain("dynamicParams = false");
    expect(route).toContain("alternates: { canonical }");
  });
});
