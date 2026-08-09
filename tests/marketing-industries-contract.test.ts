import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing industries contract", () => {
  it("does not position Proffera as cleaning-first anymore", () => {
    const industries = source("src/components/marketing/marketing-industries.tsx");

    expect(industries).toContain("Samma kundflöde – anpassat för olika typer av tjänsteföretag");
    expect(industries).toContain("The same customer flow – adapted to different service businesses");
    expect(industries).not.toContain("Proffera börjar med städning");
    expect(industries).not.toContain("Proffera starts with cleaning");
  });

  it("shows representative booking, quote and contact-led service industries", () => {
    const industries = source("src/components/marketing/marketing-industries.tsx");

    for (const value of ["Städning och lokalvård", "Salong och bokningsbara tjänster", "Hem- och teknisk service", "Lokala professionella tjänster"]) {
      expect(industries).toContain(value);
    }
    expect(industries).toContain('primaryFlow: "Bokning + offert"');
    expect(industries).toContain('primaryFlow: "Onlinebokning"');
    expect(industries).toContain('primaryFlow: "Kontakt + offert"');
  });

  it("keeps trial self-service primary and demo secondary", () => {
    const industries = source("src/components/marketing/marketing-industries.tsx");

    expect(industries).toContain('primary: "Starta gratis i 14 dagar"');
    expect(industries).toContain('secondary: "Boka demo"');
    expect(industries).toContain('const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto"');
    expect(industries).toContain('const demoHref = locale === "en" ? "/en/demo" : "/demo"');
  });

  it("keeps Swedish and English pages on the same industry component", () => {
    const swedish = source("src/app/branscher/page.tsx");
    const english = source("src/app/en/industries/page.tsx");

    expect(swedish).toContain('<MarketingIndustries locale="sv" />');
    expect(english).toContain('<MarketingIndustries locale="en" />');
  });
});
