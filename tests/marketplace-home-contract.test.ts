import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { mapSniToDirectoryCategory } from "@/lib/company-directory-policy";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketplace-first homepage contract", () => {
  it("opens with the customer need and sends search through the shared Directory flow", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(home).toContain("Vad behöver du hjälp med?");
    expect(home).toContain("Hitta företag, boka tid eller få offerter – gratis.");
    expect(home).toContain("PublicDirectorySearchForm");
    expect(home).toContain("getCachedPublishedDirectoryLocationSuggestions");
    expect(home).toContain("serviceSuggestions = t.categories.map");
    expect(home).toContain("directoryPaths[locale]");
  });

  it("keeps the three real marketplace next steps visible without a heavy explanatory section", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(home).toContain("Boka tid · Begär offert · Se företag");
    expect(home).toContain("Företagsuppgifter verifierade");
    expect(home).not.toContain("En marknadsplats, tre vägar vidare");
  });

  it("keeps business owners on a separate For business path", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const locale = source("src/lib/public-locale.ts");

    expect(home).toContain('locale === "en" ? "/en/for-business" : "/for-foretag"');
    expect(locale).toContain('{ sv: "/for-foretag", en: "/en/for-business" }');
  });

  it("uses supported service queries for marketplace category shortcuts", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const queries = ["elinstallation", "vvs", "lokalvard", "flytthjalp", "malning", "snickeri", "tradgardshjalp"];

    for (const query of queries) {
      expect(home).toContain(`query: "${query}"`);
      expect(resolveDirectoryServiceQuery(query)).not.toBeNull();
    }
    expect(home).not.toContain('query: "frisor"');
  });

  it("supports the customer's hairdresser example through the shared taxonomy", () => {
    expect(resolveDirectoryServiceQuery("frisör")).toEqual({
      kind: "service",
      serviceSlug: "frisor",
      categorySlug: "frisor",
    });
    expect(resolveDirectoryServiceQuery("barberare")).toEqual({
      kind: "service",
      serviceSlug: "frisor",
      categorySlug: "frisor",
    });
    expect(mapSniToDirectoryCategory("96.210")?.categorySlug).toBe("frisor");
  });

  it("uses semantic design tokens on the marketplace homepage", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(home).toContain("bg-canvas");
    expect(home).toContain("bg-brand-tint");
    expect(home).toContain("bg-brand-deep");
    expect(home).toContain("text-ink");
    expect(home).toContain("border-line");
    expect(home).toContain("rounded-2xl");
    expect(home).not.toMatch(/#(?:17452f|17201a|dfe5dd|f6f8f4|102a1c|f7f8f4)/i);
  });
});
