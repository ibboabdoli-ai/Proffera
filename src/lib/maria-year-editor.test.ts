import { describe, expect, it } from "vitest";
import {
  MARIA_MAX_DESCRIPTION_LENGTH, readMariaYearDescription, readMariaYearPrice,
} from "./maria-year-editor";

describe("Maria yearly prices and descriptions", () => {
  it.each([
    ["6900", 6900], ["6900.50", 6900.5], ["6900,50", 6900.5],
    ["0", 0], ["0.01", 0.01], ["250000", 250000],
  ])("accepts valid SEK price %s", (raw, expected) => {
    expect(readMariaYearPrice(raw)).toBe(expected);
  });
  it.each(["-1", "1.234", "250000.01", "1e3", "NaN", "1 000", "100,999", "250001"])(
    "rejects invalid SEK price %s", (raw) => {
      expect(() => readMariaYearPrice(raw)).toThrow("INVALID_PRICE");
    },
  );
  it("uses quote mode for blank prices", () => {
    expect(readMariaYearPrice("")).toBeNull();
    expect(readMariaYearPrice(null)).toBeNull();
  });
  it("keeps safe text per year, normalizes newline and supports default reset", () => {
    expect(readMariaYearDescription("  Provsminkning ingår!  ", "Default")).toBe("Provsminkning ingår!");
    expect(readMariaYearDescription("Line 1\r\nLine 2", "Default")).toBe("Line 1\nLine 2");
    expect(readMariaYearDescription("", "Default")).toBe("Default");
    expect(readMariaYearDescription(null, "Default")).toBe("Default");
  });
  it("rejects too-long and control-character descriptions", () => {
    expect(() => readMariaYearDescription("x".repeat(MARIA_MAX_DESCRIPTION_LENGTH + 1), "Default")).toThrow("INVALID_DESCRIPTION");
    expect(() => readMariaYearDescription("abc\u0000", "Default")).toThrow("INVALID_DESCRIPTION");
  });
});
