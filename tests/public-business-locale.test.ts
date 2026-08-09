import { describe, expect, it } from "vitest";

import {
  resolvePublicBusinessLocale,
  withPublicBusinessLocale,
} from "../src/lib/public-business-locale";

const bilingual = {
  defaultLanguage: "sv" as const,
  swedishEnabled: true,
  englishEnabled: true,
};

describe("Public Business Hub locale", () => {
  it("honors an enabled requested language", () => {
    expect(resolvePublicBusinessLocale(bilingual, "en")).toBe("en");
    expect(resolvePublicBusinessLocale(bilingual, "sv")).toBe("sv");
  });

  it("falls back to the enabled workspace default when a request is unavailable", () => {
    expect(resolvePublicBusinessLocale({ ...bilingual, englishEnabled: false }, "en")).toBe("sv");
    expect(resolvePublicBusinessLocale({ defaultLanguage: "en", swedishEnabled: false, englishEnabled: true }, "sv")).toBe("en");
  });

  it("falls back to the only enabled language when the stored default is unavailable", () => {
    expect(resolvePublicBusinessLocale({ defaultLanguage: "sv", swedishEnabled: false, englishEnabled: true })).toBe("en");
  });

  it("preserves existing query parameters when carrying locale into booking", () => {
    expect(withPublicBusinessLocale("/boka/demo?service_id=abc", "en")).toBe("/boka/demo?service_id=abc&lang=en");
  });

  it("does not alter anchors or direct contact links", () => {
    expect(withPublicBusinessLocale("#kontakt", "en")).toBe("#kontakt");
    expect(withPublicBusinessLocale("mailto:test@example.com", "en")).toBe("mailto:test@example.com");
    expect(withPublicBusinessLocale("tel:+461234", "en")).toBe("tel:+461234");
  });
});
