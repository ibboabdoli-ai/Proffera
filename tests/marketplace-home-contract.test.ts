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
    expect(home).toContain("Hitta lokala företag, boka tid eller få offerter – gratis.");
    expect(home).toContain("PublicDirectorySearchForm");
    expect(home).toContain("getCachedPublishedDirectoryLocationSuggestions");
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


  it("renders real published companies with resilient logo and media fallbacks", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");
    const media = source("src/components/marketplace/marketplace-company-media.tsx");

    expect(home).toContain("getCachedMarketplaceHomeCompanies(4)");
    expect(home).toContain("MarketplaceCompanyLogo");
    expect(home).toContain("MarketplaceCompanyCover");
    expect(home).toContain("profile.logoUrl");
    expect(home).toContain("profile.media");
    expect(media).toContain("onError={() => setFailed(true)}");
    expect(media).toContain("Building2");
  });

  it("keeps review claims truthful and sends Google through a neutral Maps search link", () => {
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(home).toContain("verified Proffera reviews");
    expect(home).toContain("verifierade Proffera-omdömen");
    expect(home).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(home).not.toContain("Google Reviews");
    expect(home).not.toContain("Google-omdömen");
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
