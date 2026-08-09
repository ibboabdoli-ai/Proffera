import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing features and pricing contract", () => {
  it("removes unfinished module-status language from the public features page", () => {
    const features = source("src/components/marketing/marketing-features.tsx");
    const swedishPage = source("src/app/tjanster/page.tsx");
    const englishPage = source("src/app/en/services/page.tsx");

    expect(features).toContain("Ett kundflöde – från första klick till slutfört jobb");
    expect(features).toContain("One customer flow – from first click to completed job");
    expect(features).not.toContain("planerad");
    expect(features).not.toContain("planned");
    expect(features).not.toContain("pilot");
    expect(features).not.toContain("beta");
    expect(swedishPage).toContain('<MarketingFeatures locale="sv" />');
    expect(englishPage).toContain('<MarketingFeatures locale="en" />');
  });

  it("shows the verified active customer workflow instead of disconnected module cards", () => {
    const features = source("src/components/marketing/marketing-features.tsx");

    for (const value of ["Företagssida", "Onlinebokning", "Offertförfrågningar", "Kund-CRM", "Kundportal", "Uppdrag", "Verifierade omdömen", "Analys"]) {
      expect(features).toContain(value);
    }
    expect(features).toContain("Samma service-ID genom kundresan");
  });

  it("keeps pricing aligned with the current Starter and Professional entitlement boundaries", () => {
    const pricing = source("src/components/marketing/marketing-pricing.tsx");

    expect(pricing).toContain('name: "Starter"');
    expect(pricing).toContain('price: "Från 299 kr/mån"');
    expect(pricing).toContain('features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Bokningspåminnelser"]');
    expect(pricing).toContain('name: "Professional"');
    expect(pricing).toContain('price: "Från 699 kr/mån"');
    expect(pricing).toContain('"Företagssida", "Offerter", "Galleri", "Verifierade omdömen", "Analys", "Flera medarbetare"');
    expect(pricing).toContain('name: "Business"');
    expect(pricing).toContain('"Egen domän"');
  });

  it("keeps Professional visibly recommended and trial signup self-service", () => {
    const pricing = source("src/components/marketing/marketing-pricing.tsx");

    expect(pricing).toContain('popular: "Mest populär"');
    expect(pricing).toContain('popular: "Most popular"');
    expect(pricing).toContain('href: "/skapa-konto?plan=starter"');
    expect(pricing).toContain('href: "/skapa-konto?plan=professional"');
    expect(pricing).toContain('href: "/en/create-account?plan=starter"');
    expect(pricing).toContain('href: "/en/create-account?plan=professional"');
  });

  it("uses shared bilingual components so Swedish and English do not drift", () => {
    const swedishFeatures = source("src/app/tjanster/page.tsx");
    const englishFeatures = source("src/app/en/services/page.tsx");
    const swedishPricing = source("src/app/priser/page.tsx");
    const englishPricing = source("src/app/en/pricing/page.tsx");

    expect(swedishFeatures).toContain("MarketingFeatures");
    expect(englishFeatures).toContain("MarketingFeatures");
    expect(swedishPricing).toContain("MarketingPricing");
    expect(englishPricing).toContain("MarketingPricing");
  });
});
