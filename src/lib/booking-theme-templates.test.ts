import { describe, expect, it } from "vitest";

import {
  BOOKING_THEME_KEYS,
  BOOKING_THEME_TEMPLATES,
  normalizeBookingThemeContentOverrides,
  resolveBookingThemeContent,
  withBookingThemeContentOverride,
} from "./booking-theme-templates";

describe("booking theme templates", () => {
  it("provides complete Swedish and English defaults for every theme", () => {
    expect(BOOKING_THEME_KEYS).toHaveLength(6);
    for (const key of BOOKING_THEME_KEYS) {
      const template = BOOKING_THEME_TEMPLATES[key];
      expect(template.heroImageUrl).toMatch(/^https:\/\//);
      for (const language of ["sv", "en"] as const) {
        const content = template.content[language];
        expect(content.heroTitle.length).toBeGreaterThan(3);
        expect(content.heroSubtitle.length).toBeGreaterThan(3);
        expect(content.heroDescription.length).toBeGreaterThan(10);
        expect(content.ctaLabel.length).toBeGreaterThan(1);
        expect(content.faqTitle.length).toBeGreaterThan(3);
        expect(content.faqBody.length).toBeGreaterThan(10);
        expect(content.serviceSamples.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses workspace overrides without changing the central defaults", () => {
    const overrides = withBookingThemeContentOverride({}, "salon", {
      heroTitleSv: "Min salong",
      heroTitleEn: "My salon",
      heroImageUrl: "https://example.com/custom.jpg",
    });

    expect(resolveBookingThemeContent("salon", "sv", overrides).heroTitle).toBe("Min salong");
    expect(resolveBookingThemeContent("salon", "en", overrides).heroTitle).toBe("My salon");
    expect(resolveBookingThemeContent("salon", "sv", overrides).heroImageUrl).toBe("https://example.com/custom.jpg");
    expect(BOOKING_THEME_TEMPLATES.salon.content.sv.heroTitle).toBe("Din stil. Vårt hantverk.");
  });

  it("removes a workspace override when reset", () => {
    const overrides = withBookingThemeContentOverride({}, "restaurant", { heroTitleSv: "Egen rubrik" });
    const reset = withBookingThemeContentOverride(overrides, "restaurant", null);
    expect(reset.restaurant).toBeUndefined();
    expect(resolveBookingThemeContent("restaurant", "sv", reset).heroTitle).toBe(BOOKING_THEME_TEMPLATES.restaurant.content.sv.heroTitle);
  });

  it("drops unknown themes and unknown fields from stored json", () => {
    const normalized = normalizeBookingThemeContentOverrides({
      salon: { heroTitleSv: " Salong ", unsafe: "ignored" },
      unknown: { heroTitleSv: "Nope" },
    });
    expect(normalized).toEqual({ salon: { heroTitleSv: "Salong" } });
  });
});
