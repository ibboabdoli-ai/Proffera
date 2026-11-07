import { describe, expect, it } from "vitest";

import { resolveMariaPublicBookingLocale } from "./maria-public-booking-locale";

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
});
