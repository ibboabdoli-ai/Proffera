import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { MarketingPricing } from "../src/components/marketing/marketing-pricing";
import { SignupForm } from "../src/components/signup/signup-form";
import { pricingPlans } from "../src/lib/site";

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

  it("renders the canonical 299/599 launch prices on Swedish and English pricing surfaces", () => {
    const swedish = renderToStaticMarkup(createElement(MarketingPricing, { locale: "sv" }));
    const english = renderToStaticMarkup(createElement(MarketingPricing, { locale: "en" }));

    expect(swedish).toContain("299 kr/mån");
    expect(swedish).toContain("599 kr/mån");
    expect(swedish).not.toContain("199 kr/mån");
    expect(swedish).not.toContain("699 kr/mån");

    expect(english).toContain("SEK 299/month");
    expect(english).toContain("SEK 599/month");
    expect(english).not.toContain("SEK 199/month");
    expect(english).not.toContain("SEK 699/month");
  });

  it("renders the same canonical prices in signup and shared site pricing", () => {
    const swedishSignup = renderToStaticMarkup(createElement(SignupForm, {
      locale: "sv",
      initialPlan: "starter",
      sessionUser: { name: "Test Owner", email: "owner@example.com" },
    }));
    const englishSignup = renderToStaticMarkup(createElement(SignupForm, {
      locale: "en",
      initialPlan: "starter",
      sessionUser: { name: "Test Owner", email: "owner@example.com" },
    }));

    expect(swedishSignup).toContain("Starter – från 299 kr/mån");
    expect(swedishSignup).toContain("Professional – från 599 kr/mån");
    expect(englishSignup).toContain("Starter – from SEK 299/month");
    expect(englishSignup).toContain("Professional – from SEK 599/month");

    expect(pricingPlans.find((plan) => plan.name === "Starter")?.price).toBe("299 kr/mån");
    expect(pricingPlans.find((plan) => plan.name === "Professional")?.price).toBe("599 kr/mån");
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
