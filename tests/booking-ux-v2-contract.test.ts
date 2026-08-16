import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Booking UX 2.0 contract", () => {
  const ux = source("src/app/boka/[slug]/booking-ux-v2.css");
  const contrast = source("src/app/boka/[slug]/booking-contrast.css");
  const form = source("src/app/boka/[slug]/booking-request-form.tsx");

  it("loads the UX 2.0 layer through the existing public booking CSS graph", () => {
    expect(contrast).toContain('@import "./booking-ux-v2.css";');
  });

  it("uses Design System 2.0 semantics while preserving tenant brand variables", () => {
    expect(ux).toContain("var(--pf-canvas)");
    expect(ux).toContain("var(--pf-surface)");
    expect(ux).toContain("var(--pf-line)");
    expect(ux).toContain("var(--pf-radius-control)");
    expect(ux).toContain("var(--pf-radius-card)");
    expect(ux).toContain("var(--pf-shadow-card)");
    expect(ux).toContain("var(--booking-primary)");
  });

  it("keeps Restaurant v3 outside the shared redesign", () => {
    expect(ux).toContain(':not([data-booking-theme="restaurant"])');
    expect(ux).not.toContain('[data-booking-theme="restaurant"] > main:first-child');
  });

  it("improves responsive booking ergonomics without changing booking behavior", () => {
    expect(ux).toContain("position: sticky");
    expect(ux).toContain("font-size: 16px !important;");
    expect(ux).toContain("prefers-reduced-motion: reduce");
    expect(form).toContain('data-booking-form="default"');
    expect(form).toContain('data-booking-form="guided"');
    expect(form).toContain("getAvailableBookingTimes");
  });
});
