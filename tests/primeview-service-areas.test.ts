import { describe, expect, it } from "vitest";

import { primeViewAreaPages } from "../src/lib/primeview-area-pages";

describe("PrimeView service areas", () => {
  it("keeps the expanded customer-approved coverage list unique", () => {
    expect(primeViewAreaPages).toHaveLength(88);
    expect(new Set(primeViewAreaPages.map((area) => area.slug)).size).toBe(primeViewAreaPages.length);
    expect(new Set(primeViewAreaPages.map((area) => area.name)).size).toBe(primeViewAreaPages.length);
  });

  it("includes the requested west and north London coverage", () => {
    const names = new Set<string>(primeViewAreaPages.map((area) => area.name));
    for (const area of [
      "Hammersmith",
      "Chiswick",
      "Brentford",
      "Hounslow",
      "Kingston upon Thames",
      "Epsom",
      "Camden",
      "Hampstead",
      "Finchley",
      "Barnet",
      "Enfield",
      "Arnos Grove",
    ]) {
      expect(names.has(area), area).toBe(true);
    }
  });
});
