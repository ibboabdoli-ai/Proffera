import { describe, expect, it } from "vitest";

import { safeEmailHref, safePhoneHref } from "@/components/salon/salon-dashboard-demo";

describe("salon demo customer contact links", () => {
  it("accepts dialable Swedish phone numbers and ordinary email addresses", () => {
    expect(safePhoneHref("+46 70-123 45 67")).toBe("tel:+46701234567");
    expect(safeEmailHref("test@example.se")).toBe("mailto:test@example.se");
  });

  it("never renders action links from malformed or untrusted contact values", () => {
    expect(safePhoneHref("javascript:alert(1)")).toBeUndefined();
    expect(safePhoneHref("Demo telefon")).toBeUndefined();
    expect(safeEmailHref("a@example.se?bcc=other@example.se")).toBeUndefined();
    expect(safeEmailHref("a\n@b.se")).toBeUndefined();
    expect(safeEmailHref("Demo e-post")).toBeUndefined();
  });

  it("rejects missing or malformed contact fields from unvalidated localStorage", () => {
    for (const value of [undefined, null, 42, {}, ["+46701234567"]]) {
      expect(safePhoneHref(value)).toBeUndefined();
      expect(safeEmailHref(value)).toBeUndefined();
    }
  });

  it("percent-encodes unsafe percent escapes in legitimate email local parts", () => {
    expect(safeEmailHref("a%0Ab@example.se")).toBe("mailto:a%250Ab@example.se");
  });
});
