import { describe, expect, it } from "vitest";

import { resolveMariaBookingLandingDestination, resolveMariaPublicBookingLocale } from "./maria-public-booking-locale";

describe("Maria public booking deep-link language", () => {
  it.each([
    ["ar", "ar"],
    ["en", "en"],
    ["sv", "sv"],
    ["de", "sv"],
    [undefined, "sv"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(resolveMariaPublicBookingLocale(input)).toBe(expected);
  });

  it("uses only the first query value if the language repeats", () => {
    expect(resolveMariaPublicBookingLocale(["ar", "en"])).toBe("ar");
    expect(resolveMariaPublicBookingLocale(["invalid", "ar"])).toBe("sv");
  });

  it.each(["sv", "en", "ar"] as const)("routes verified Production success to Maria root in %s", locale => {
    expect(resolveMariaBookingLandingDestination(locale, true, "production"))
      .toBe(`https://makeupbymaria.se/?lang=${locale}&booked=1`);
    expect(resolveMariaBookingLandingDestination(locale, false, "production"))
      .toBe(`https://makeupbymaria.se/?lang=${locale}`);
  });

  it("keeps Preview on its isolated demo path and preserves Arabic deep links", () => {
    expect(resolveMariaBookingLandingDestination(["ar", "en"], true, "preview"))
      .toBe("/demo/makeup-by-maria-v2.html?lang=ar&booked=1");
    expect(resolveMariaBookingLandingDestination("sv", false, "preview"))
      .toBe("/demo/makeup-by-maria-v2.html?lang=sv");
  });
});
