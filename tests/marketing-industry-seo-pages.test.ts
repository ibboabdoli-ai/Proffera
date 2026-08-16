import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  marketingIndustryPages,
  marketingIndustrySlugs,
} from "../src/lib/marketing-industry-pages";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Swedish industry SEO pages", () => {
  it("keeps the initial Sweden-first industry cluster explicit", () => {
    expect(marketingIndustrySlugs).toEqual([
      "frisorer",
      "stadforetag",
      "hantverkare",
      "serviceforetag",
    ]);
    expect(Object.keys(marketingIndustryPages)).toEqual([...marketingIndustrySlugs]);
  });

  it("gives every industry a unique title, description and substantial customer flow", () => {
    const pages = Object.values(marketingIndustryPages);
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);

    for (const page of pages) {
      expect(page.title.length).toBeGreaterThan(20);
      expect(page.description.length).toBeGreaterThan(80);
      expect(page.fitPoints.length).toBeGreaterThanOrEqual(4);
      expect(page.flow.length).toBe(4);
      expect(page.features.length).toBeGreaterThanOrEqual(4);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.serviceLinks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps claims inside the verified Proffera product scope", () => {
    const copy = JSON.stringify(marketingIndustryPages).toLowerCase();
    expect(copy).not.toContain("fortnox");
    expect(copy).not.toContain("automatisk fakturering");
    expect(copy).not.toContain("rut-beräkning ingår");
    expect(copy).not.toContain("fler bokningar");
    expect(copy).not.toContain("marknadsledande");
  });

  it("uses a static allowlist, canonical metadata and Swedish-only sitemap discovery", () => {
    const route = source("src/app/branscher/[slug]/page.tsx");
    const sitemap = source("src/app/sitemap.ts");

    expect(route).toContain("export const dynamicParams = false");
    expect(route).toContain("generateStaticParams");
    expect(route).toContain("alternates: { canonical }");
    expect(route).toContain("/branscher/${page.slug}");
    expect(sitemap).toContain("marketingIndustrySlugs");
    expect(sitemap).toContain("/branscher/${slug}");
  });

  it("links the industry hub to every dedicated page", () => {
    const hub = source("src/app/branscher/page.tsx");
    expect(hub).toContain("marketingIndustryPages");
    expect(hub).toContain("/branscher/${page.slug}");
    expect(hub).toContain("Branschguider");
  });
});
