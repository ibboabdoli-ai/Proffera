import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("booking page builder foundation", () => {
  it("provides a self-service visual builder with central templates and responsive preview modes", () => {
    const builder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");
    const templates = source("src/lib/booking-theme-templates.ts");

    expect(builder).toContain("data-booking-page-builder");
    expect(builder).toContain("Live design preview");
    expect(builder).toContain('type Device = "desktop" | "tablet" | "mobile"');
    expect(builder).toContain("BOOKING_THEME_TEMPLATES");
    for (const key of ["clean", "salon", "premium", "modern", "minimal", "restaurant"]) {
      expect(templates).toContain(`${key}: {`);
      expect(templates).toContain(`key: "${key}"`);
    }
  });

  it("keeps existing booking sections and domain controls in the central builder", () => {
    const builder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");
    const page = source("src/app/dashboard/installningar/utseende/page.tsx");

    for (const name of ["heroEnabled", "servicesEnabled", "staffEnabled", "reviewsEnabled", "galleryEnabled", "contactEnabled", "faqEnabled", "chatbotEnabled"]) {
      expect(builder).toContain(name);
    }
    expect(builder).toContain("Din Proffera-adress");
    expect(builder).toContain("Köp domän via Proffera");
    expect(page).toContain("public_booking_slug");
    expect(page).toContain("<BookingPageBuilder");
    expect(page).toContain("<ThemeContentEditor");
    expect(page).toContain("data-domain-connection-status");
  });

  it("continues to validate language and custom-domain changes on the server", () => {
    const page = source("src/app/dashboard/installningar/utseende/page.tsx");

    expect(page).toContain('if (!swedishEnabled && !englishEnabled)');
    expect(page).toContain("normalizeCustomDomainInput");
    expect(page).toContain("ensureVercelCustomDomain");
    expect(page).toContain("removeVercelCustomDomain");
    expect(page).toContain("requestedDefaultLanguage");
  });
});
