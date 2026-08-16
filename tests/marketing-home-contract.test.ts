import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing homepage contract", () => {
  it("positions Proffera around the full customer workflow instead of module status", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");

    expect(home).toContain("Visa dina tjänster. Få in kunder. Hantera hela jobbet i Proffera.");
    expect(home).toContain("Från synlig tjänst till slutfört jobb");
    expect(home).toContain("Företagssida + tjänstekatalog");
    expect(home).toContain("Exempel på arbetsyta");
    expect(home).not.toContain("Aktiv modul");
    expect(home).not.toContain("Kommande modul");
    expect(home).not.toContain("Tillgänglig i pilot");
  });

  it("uses one self-service trial as the primary funnel and keeps demo secondary", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");
    const locale = source("src/lib/public-locale.ts");

    expect(home).toContain('primaryCta: "Starta gratis i 14 dagar"');
    expect(home).toContain('finalPrimary: "Starta gratis i 14 dagar"');
    expect(home).toContain('finalSecondary: "Boka demo"');
    expect(locale).toContain('primaryCtaLabel: "Starta gratis i 14 dagar"');
  });

  it("does not expose vendor implementation details or invented social proof on the homepage", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");

    expect(home).not.toContain("Brevo");
    expect(home).not.toContain("Pilotkund");
    expect(home).not.toContain("Case study");
    expect(home).not.toContain("Småföretagare i Stockholmsområdet");
  });

  it("keeps Swedish and English homepages on the same V2 component", () => {
    const swedish = source("src/app/page.tsx");
    const english = source("src/app/en/page.tsx");

    expect(swedish).toContain('from "@/components/marketing/marketing-home-v2"');
    expect(english).toContain('from "@/components/marketing/marketing-home-v2"');
    expect(swedish).toContain('<MarketingHome locale="sv" />');
    expect(english).toContain('<MarketingHome locale="en" />');
  });

  it("uses the Design System 2.0 semantic tokens and avoids the migrated core hex palette", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");

    expect(home).toContain("bg-canvas");
    expect(home).toContain("bg-brand-deep");
    expect(home).toContain("text-ink");
    expect(home).toContain("border-line");
    expect(home).toContain("rounded-panel");
    expect(home).toContain("shadow-lift");
    expect(home).not.toMatch(/#(?:17452f|17201a|dfe5dd|f6f8f4|102a1c)/i);
  });

  it("keeps pricing and conversion paths aligned with the verified public offer", () => {
    const home = source("src/components/marketing/marketing-home-v2.tsx");

    expect(home).toContain('price: "199 kr/mån"');
    expect(home).toContain('price: "599 kr/mån"');
    expect(home).toContain('href: "/skapa-konto?plan=starter"');
    expect(home).toContain('href: "/skapa-konto?plan=professional"');
    expect(home).toContain('href: "/en/create-account?plan=starter"');
    expect(home).toContain('href: "/en/create-account?plan=professional"');
  });

  it("keeps navigation focused on product discovery, pricing and conversion", () => {
    const site = source("src/lib/site.ts");
    const locale = source("src/lib/public-locale.ts");

    expect(site).toContain('{ label: "Funktioner", href: "/tjanster" }');
    expect(site).not.toContain('{ label: "Om", href: "/om" }');
    expect(site).not.toContain('{ label: "Kontakt", href: "/kontakt" }');
    expect(locale).toContain('{ label: "Features", href: "/en/services" }');
    expect(locale).not.toContain('{ label: "About", href: "/en/about" }');
  });
});
