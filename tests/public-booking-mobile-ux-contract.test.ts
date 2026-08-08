import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public booking mobile UX contract", () => {
  it("keeps booking routes outside the public Proffera header/footer shell", () => {
    const shell = source("src/components/layout/app-shell.tsx");
    expect(shell).toContain('pathname?.startsWith("/boka")');
  });

  it("prioritizes booking choices before customer details in every default theme", () => {
    const css = source("src/app/boka/[slug]/booking-theme-controls.css");
    expect(css).toContain('label:nth-of-type(4) { order: 10; }');
    expect(css).toContain('input[type="date"] { order: 20; }');
    expect(css).toContain('select[aria-label] { order: 30; }');
    expect(css).toContain('label:nth-of-type(1) { order: 40; }');
    expect(css).toContain('label:nth-of-type(2) { order: 50; }');
    expect(css).toContain('label:nth-of-type(3) { order: 60; }');
  });

  it("keeps language controls readable and mobile booking controls compact", () => {
    const css = source("src/app/boka/[slug]/booking-theme-controls.css");
    expect(css).toContain('nav[aria-label="Language"] a[class~="bg-white"]');
    expect(css).toContain('color: #17201a !important;');
    expect(css).toContain('min-height: 3.2rem !important;');
  });

  it("uses a light hospitality canvas for the Restaurant theme", () => {
    const css = source("src/app/boka/[slug]/booking-theme-controls.css");
    expect(css).toContain('[data-booking-theme="restaurant"] > main:first-child');
    expect(css).toContain('linear-gradient(180deg, #f8f2e9 0%, #f2e8dc 100%)');
    expect(css).toContain('background: rgb(255 252 247 / 96%) !important;');
  });
});
