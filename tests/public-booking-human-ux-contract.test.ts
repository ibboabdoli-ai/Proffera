import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public booking human-designed UX contract", () => {
  it("keeps booking policy and verification behavior while replacing the public shell", () => {
    const page = source("src/app/boka/[slug]/page.tsx");
    const styles = source("src/app/boka/[slug]/public-booking-marketplace.module.css");

    expect(page).toContain("validatePublicBookingPolicy");
    expect(page).toContain("allowPublicSubmission");
    expect(page).toContain("beginBookingEmailVerification");
    expect(page).toContain("hasWorkspaceFeatureAccessForWorkspace");
    expect(page).toContain("BookingRequestForm");
    expect(page).toContain("styles.bookingPanel");
    expect(page).toContain("styles.sideColumn");
    expect(styles).toContain("var(--booking-primary)");
    expect(styles).toContain("prefers-reduced-motion");
  });

  it("keeps Swedish and English booking states including unavailable and verification pages", () => {
    const page = source("src/app/boka/[slug]/page.tsx");
    const verify = source("src/app/boka/verifiera/[id]/page.tsx");

    expect(page).toContain("sv: {");
    expect(page).toContain("en: {");
    expect(page).toContain("requestedQueryLocale");
    expect(page).toContain("return <Unavailable locale={requestedQueryLocale} />");
    expect(page).toContain("lang=sv");
    expect(page).toContain("lang=en");

    expect(verify).toContain("sv: {");
    expect(verify).toContain("en: {");
    expect(verify).toContain("verificationHref");
    expect(verify).toContain("formData.get(\"lang\") === \"en\"");
    expect(verify).toContain("publicBookingSuccessRedirect(result.slug, locale)");
  });

  it("keeps service-first booking ordering and first-available-time behavior", () => {
    const form = source("src/app/boka/[slug]/booking-request-form.tsx");
    const controls = source("src/app/boka/[slug]/booking-theme-controls.css");

    expect(form).toContain("function chooseDefaultService(id: string)");
    expect(form).toContain("const first = firstAvailability.get(id)");
    expect(form).toContain("setDate(first?.date ?? today)");
    expect(form).toContain("data-booking-form=\"default\"");
    expect(controls).toContain("label:nth-of-type(4) { order: 10; }");
    expect(controls).toContain("input[type=\"date\"] { order: 20; }");
    expect(controls).toContain("select[aria-label] { order: 30; }");
  });

  it("uses real tenant media and theme variables without fabricating booking data", () => {
    const page = source("src/app/boka/[slug]/page.tsx");

    expect(page).toContain("experience.logoUrl");
    expect(page).toContain("experience.heroImageUrl");
    expect(page).toContain("experience.heroVideoUrl");
    expect(page).toContain("--booking-primary");
    expect(page).toContain("--booking-accent");
    expect(page).toContain("visibleServices");
    expect(page).toContain("publishedHours");
  });
});
