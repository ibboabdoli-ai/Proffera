import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Minimal public booking polish", () => {
  it("keeps the Minimal hero light, compact and readable", () => {
    const css = source("src/app/boka/[slug]/booking-polish.css");

    expect(css).toContain('/* Minimal v2 — quiet Scandinavian design instead of a harsh brutalist surface. */');
    expect(css).toContain('[data-booking-theme="minimal"] > main:first-child > section:first-child p');
    expect(css).toContain('color: #5f6b63 !important;');
    expect(css).toContain('[data-booking-theme="minimal"] nav[aria-label="Language"] a');
    expect(css).toContain('color: #243028 !important;');
  });

  it("does not reserve a fixed 208px hero height for failed images", () => {
    const css = source("src/app/boka/[slug]/booking-polish.css");

    expect(css).toContain('[data-booking-theme="minimal"] > main:first-child > section:first-child > div > img');
    expect(css).toContain('height: auto !important;');
    expect(css).toContain('max-height: 10rem !important;');
    expect(css).toContain('min-height: 0 !important;');
  });

  it("uses restrained rounded surfaces instead of the previous square brutalist treatment", () => {
    const css = source("src/app/boka/[slug]/booking-polish.css");

    expect(css).toContain('border-radius: 1.4rem !important;');
    expect(css).toContain('border-radius: 1.15rem !important;');
    expect(css).toContain('border-radius: .8rem !important;');
  });
});
