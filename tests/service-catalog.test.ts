import { describe, expect, it } from "vitest";

import { directoryCategoryLabels } from "@/components/company-directory/public-directory-copy";
import { quoteCategoryLabel } from "@/features/quote-request/localization";
import { serviceTypesByCategory } from "@/features/quote-request/schema";
import { mapSniToDirectoryCategory } from "@/lib/company-directory-policy";
import {
  quoteServiceTypesByCategory,
  serviceCategoryCatalog,
  serviceCategoryForQuoteCategory,
  serviceCategoryLabel,
  serviceCategorySlugs,
} from "@/lib/service-catalog";

const expectedDirectorySlugs = [
  "stadning",
  "flytt",
  "elektriker",
  "vvs",
  "maleri",
  "snickeri",
  "tradgard",
  "hemservice",
] as const;

describe("central service catalog", () => {
  it("keeps the canonical Directory category slugs and bilingual labels stable", () => {
    expect(serviceCategorySlugs).toEqual(expectedDirectorySlugs);
    expect(new Set(serviceCategorySlugs).size).toBe(serviceCategorySlugs.length);

    for (const slug of expectedDirectorySlugs) {
      expect(serviceCategoryLabel(slug, "sv")).toBeTruthy();
      expect(serviceCategoryLabel(slug, "en")).toBeTruthy();
      expect(directoryCategoryLabels.sv[slug]).toBe(serviceCategoryCatalog[slug].labels.sv);
      expect(directoryCategoryLabels.en[slug]).toBe(serviceCategoryCatalog[slug].labels.en);
    }

    expect(serviceCategoryLabel("stadning", "sv")).toBe("Städning");
    expect(serviceCategoryLabel("stadning", "en")).toBe("Cleaning");
    expect(serviceCategoryLabel("vvs", "en")).toBe("Plumbing");
  });

  it("keeps the existing Quote taxonomy wired to the central catalog", () => {
    expect(serviceTypesByCategory).toBe(quoteServiceTypesByCategory);

    for (const category of Object.values(serviceCategoryCatalog)) {
      for (const quoteCategory of category.quoteCategories) {
        expect(Object.hasOwn(serviceTypesByCategory, quoteCategory)).toBe(true);
      }
    }

    expect(serviceTypesByCategory["Hemstädning"]).toEqual(["Engångsstädning", "Återkommande städning", "Storstädning"]);
    expect(serviceTypesByCategory["VVS"]).toContain("Värmepump");
  });

  it("keeps existing English Quote category labels unchanged", () => {
    expect(quoteCategoryLabel("Städning", "en")).toBe("Cleaning");
    expect(quoteCategoryLabel("Hemstädning", "en")).toBe("Home cleaning");
    expect(quoteCategoryLabel("Flytthjälp", "en")).toBe("Moving help");
    expect(quoteCategoryLabel("Renovering", "en")).toBe("Renovation");
  });

  it("does not invent a Directory category for quote-only renovation", () => {
    expect(serviceCategoryForQuoteCategory("Renovering")).toBeNull();
    expect(serviceCategoryForQuoteCategory("Flytthjälp")).toBe("flytt");
  });

  it("keeps SNI mapping labels sourced from the same catalog", () => {
    expect(mapSniToDirectoryCategory("81.210")).toEqual({
      categorySlug: "stadning",
      categoryLabel: "Städning",
      serviceSlugs: [],
    });
    expect(mapSniToDirectoryCategory("43.221")?.categoryLabel).toBe(serviceCategoryLabel("vvs", "sv"));
  });
});
