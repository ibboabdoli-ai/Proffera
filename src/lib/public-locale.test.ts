import { describe, expect, it } from "vitest";

import {
  getAlternateLocalePath,
  getLocalizedRoute,
  getPublicLocale,
  isEnglishPublicPath,
} from "./public-locale";

describe("public locale routing", () => {
  it("recognizes English public routes without changing Swedish routes", () => {
    expect(getPublicLocale("/")).toBe("sv");
    expect(getPublicLocale("/en")).toBe("en");
    expect(getPublicLocale("/en/join-business/register")).toBe("en");
    expect(getPublicLocale("/dashboard")).toBe("sv");
    expect(isEnglishPublicPath("/en/services")).toBe(true);
    expect(isEnglishPublicPath("/tjanster")).toBe(false);
  });

  it("maps matching Swedish and English public routes in both directions", () => {
    expect(getLocalizedRoute("/demo", "en")).toBe("/en/demo");
    expect(getLocalizedRoute("/demo", "sv")).toBe("/demo");
    expect(getAlternateLocalePath("/priser")).toBe("/en/pricing");
    expect(getAlternateLocalePath("/en/join-business/register")).toBe("/anslut-foretag/registrera");
    expect(getAlternateLocalePath("/en/")).toBe("/");
  });

  it("does not present a false language switch for untranslated product routes", () => {
    expect(getAlternateLocalePath("/boka/a-real-workspace")).toBeNull();
    expect(getAlternateLocalePath("/logga-in")).toBeNull();
  });
});
