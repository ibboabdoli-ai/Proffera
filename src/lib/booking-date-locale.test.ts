import { describe, expect, it } from "vitest";
import { bookingDateLocale } from "./booking-date-locale";

describe("booking calendar consistency across languages", () => {
  it("uses the Gregorian calendar in Arabic without altering Swedish or English", () => {
    expect(bookingDateLocale("ar")).toBe("ar-SA-u-ca-gregory");
    expect(bookingDateLocale("en")).toBe("en-GB");
    expect(bookingDateLocale("sv")).toBe("sv-SE");
    const date = new Date("2027-06-18T08:00:00.000Z");
    const formatted = new Intl.DateTimeFormat(bookingDateLocale("ar"), {
      timeZone: "Europe/Stockholm", year: "numeric", month: "long", day: "numeric",
    });
    expect(formatted.resolvedOptions().calendar).toBe("gregory");
    const year = formatted.formatToParts(date).find((part) => part.type === "year")?.value ?? "";
    const ascii = year.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
    expect(ascii).toBe("2027");
  });
});
