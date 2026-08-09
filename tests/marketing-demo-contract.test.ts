import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing demo contract", () => {
  it("shows the active customer workflow without planned-module marketing", () => {
    const demo = source("src/components/marketing/marketing-demo.tsx");

    expect(demo).toContain("Se hela kundresan – från tjänstesida till uppföljning");
    expect(demo).toContain("Företagssida och tjänster");
    expect(demo).toContain("Bokning och offert");
    expect(demo).toContain("Dashboard, CRM och uppdrag");
    expect(demo).toContain("Uppföljning och analys");
    expect(demo).not.toContain("AI-stöd");
    expect(demo).not.toContain("AI support");
    expect(demo).not.toContain("planerat");
    expect(demo).not.toContain("planned modules");
  });

  it("describes the demo request accurately and keeps self-service available", () => {
    const demo = source("src/components/marketing/marketing-demo.tsx");

    expect(demo).toContain('primary: "Skicka demoförfrågan"');
    expect(demo).toContain('secondary: "Starta gratis i 14 dagar"');
    expect(demo).toContain('const demoRequestHref = locale === "en" ? "/en/join-business/register" : "/anslut-foretag/registrera"');
    expect(demo).toContain('const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto"');
    expect(demo).toContain("skapar ingen betalning");
  });

  it("keeps Swedish and English demo pages on the same component", () => {
    const swedish = source("src/app/demo/page.tsx");
    const english = source("src/app/en/demo/page.tsx");

    expect(swedish).toContain('<MarketingDemo locale="sv" />');
    expect(english).toContain('<MarketingDemo locale="en" />');
  });
});
