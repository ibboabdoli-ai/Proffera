import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing homepage contract", () => {
  it("keeps the legacy business marketing component free of module-status copy", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");

    expect(home).not.toContain("Aktiv modul");
    expect(home).not.toContain("Kommande modul");
    expect(home).not.toContain("Tillgänglig i pilot");
  });

  it("keeps the self-service trial offer available to business customers", () => {
    const business = source("src/components/marketplace/business-home.tsx");
    const locale = source("src/lib/public-locale.ts");

    expect(business).toContain('primary: "Starta gratis i 14 dagar"');
    expect(business).toContain('const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto"');
    expect(locale).toContain('primaryCtaLabel: "Starta gratis i 14 dagar"');
  });

  it("does not expose vendor implementation details or invented social proof on the business landing page", () => {
    const business = source("src/components/marketplace/business-home.tsx");

    expect(business).not.toContain("Brevo");
    expect(business).not.toContain("Pilotkund");
    expect(business).not.toContain("Case study");
    expect(business).not.toContain("Småföretagare i Stockholmsområdet");
  });

  it("makes Swedish and English roots marketplace-first and keeps business landing pages separate", () => {
    const swedish = source("src/app/page.tsx");
    const english = source("src/app/en/page.tsx");
    const swedishBusiness = source("src/app/for-foretag/page.tsx");
    const englishBusiness = source("src/app/en/for-business/page.tsx");

    expect(swedish).toContain('from "@/components/marketplace/marketplace-home"');
    expect(english).toContain('from "@/components/marketplace/marketplace-home"');
    expect(swedish).toContain('<MarketplaceHome locale="sv" />');
    expect(english).toContain('<MarketplaceHome locale="en" />');
    expect(swedishBusiness).toContain('from "@/components/marketplace/business-home"');
    expect(englishBusiness).toContain('from "@/components/marketplace/business-home"');
    expect(swedishBusiness).toContain('<BusinessHome locale="sv" />');
    expect(englishBusiness).toContain('<BusinessHome locale="en" />');
  });

  it("uses Design System semantic tokens on the new business landing page", () => {
    const business = source("src/components/marketplace/business-home.tsx");

    expect(business).toContain("bg-canvas");
    expect(business).toContain("bg-brand-deep");
    expect(business).toContain("text-ink");
    expect(business).toContain("border-line");
    expect(business).toContain("rounded-panel");
    expect(business).toContain("shadow-lift");
    expect(business).not.toMatch(/#(?:17452f|17201a|dfe5dd|f6f8f4|102a1c)/i);
  });

  it("keeps business navigation focused on product discovery, pricing and conversion away from the marketplace root", () => {
    const site = source("src/lib/site.ts");
    const locale = source("src/lib/public-locale.ts");
    const header = source("src/components/layout/header.tsx");

    expect(site).toContain('{ label: "Funktioner", href: "/tjanster" }');
    expect(locale).toContain('{ label: "Features", href: "/en/services" }');
    expect(header).toContain("const marketplaceHome = pathname === \"/\" || pathname === \"/en\"");
    expect(header).toContain('locale === "en" ? "For businesses" : "För företag"');
  });
});