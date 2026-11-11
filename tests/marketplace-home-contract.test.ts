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
    expect(home).not.toContain("getCachedPublishedDirectoryLocationSuggestions");
    expect(home).toContain(".filter((category) => category.query)");
    expect(home).toContain("directoryPaths[locale]");
  });

  it("keeps the three real marketplace next steps visible without a heavy explanatory section", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(home).toContain("Boka tid · Begär offert · Se omdömen");
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
    const queries = ["elinstallation", "vvs", "lokalvard", "flytthjalp", "malning", "snickeri", "tradgardshjalp", "varmepump"];

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


  it("avoids all automatic public company and city reads on the homepage", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    expect(home).not.toContain("getCachedMarketplaceHomeCompanies(4)");
    expect(home).not.toContain("getCachedPublishedDirectoryLocationSuggestions(24)");
    expect(home).not.toContain("MarketplaceCompanyLogo");
    expect(home).toContain("Välj en tjänst och ange en adress");
  });

  it("offers an on-demand service search without fake public company claims", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const form = source("src/components/company-directory/public-directory-search-form.tsx");
    expect(home).toContain("PublicDirectorySearchForm");
    expect(form).toContain('name="address"');
    expect(form).toContain('type="range"');
    expect(form).toContain("searchPublicDirectoryNearbyAction");
    expect(form).toContain("searchPublicDirectoryAddressAction");
    expect(home).not.toContain("Google-omdömen");
  });

  it("keeps the homepage hero compact without altering Directory search authorization", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const styles = source("src/components/marketplace/marketplace-home.module.css");
    const form = source("src/components/company-directory/public-directory-search-form.tsx");

    expect(home).not.toContain("photo-1621905251189-08b45d6a269e");
    expect(home).not.toContain("photo-1581578731548-c64695cc6952");
    expect(home).toContain('src="/marketplace/hero-electrician.jpg"');
    expect(styles).toMatch(/@media \(min-width: 701px\) \{[\s\S]*?\.marketplaceSearch :global\(form\) \{[\s\S]*?align-items: start;/);
    expect(styles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr)) !important;");
    expect(styles).toContain(".marketplaceSearch :global(form > label:nth-child(1))");
    expect(styles).toContain(".marketplaceSearch :global(form > div:nth-child(3))");
    expect(styles).toContain("@media (max-width: 700px)");
    expect(styles).toContain("grid-template-columns: 1fr !important;");
    expect(form).toContain('name="address"');
    expect(form).toContain('min={1} max={50}');
    expect(form).toContain("searchPublicDirectoryNearbyAction");
    expect(form).toContain("refinePublicDirectoryNearbyAction");
    expect(home).not.toContain("getCachedMarketplaceHomeCompanies");
  });

  it("locks the approved marketplace visual system and compact service rail", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const styles = source("src/components/marketplace/marketplace-home.module.css");

    expect(home).toContain("serviceRail");
    expect(home).toContain("PaintRoller");
    expect(home).toContain("Snowflake");
    expect(home).toContain("BadgeCheck");
    expect(styles).toContain("--marketplace-navy: #0a2e63");
    expect(styles).toContain("--marketplace-blue: #1469d8");
    expect(styles).toContain("scroll-snap-type: x proximity");
    expect(styles).toContain("prefers-reduced-motion");
  });
});
