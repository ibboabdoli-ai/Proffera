import { describe, expect, it } from "vitest";

import {
  isProviderMarketplaceConversionMode,
  normalizeProviderServiceAreaRadius,
  normalizeSwedishOrganizationNumber,
} from "./company-directory-provider-activation-policy";

describe("company directory provider activation policy", () => {
  it("normalizes Swedish organization numbers without guessing incomplete values", () => {
    expect(normalizeSwedishOrganizationNumber("556123-4567")).toBe("5561234567");
    expect(normalizeSwedishOrganizationNumber("556 123 4567")).toBe("5561234567");
    expect(normalizeSwedishOrganizationNumber("556123456")).toBeNull();
    expect(normalizeSwedishOrganizationNumber("55612345678")).toBeNull();
    expect(normalizeSwedishOrganizationNumber("SE556123456701")).toBeNull();
  });

  it("accepts only marketplace conversion modes", () => {
    expect(isProviderMarketplaceConversionMode("book")).toBe(true);
    expect(isProviderMarketplaceConversionMode("quote")).toBe(true);
    expect(isProviderMarketplaceConversionMode("book_or_quote")).toBe(true);
    expect(isProviderMarketplaceConversionMode("contact")).toBe(true);
    expect(isProviderMarketplaceConversionMode("other")).toBe(false);
  });

  it("bounds owner-confirmed service areas", () => {
    expect(normalizeProviderServiceAreaRadius("25")).toBe(25);
    expect(normalizeProviderServiceAreaRadius("25.24")).toBe(25.2);
    expect(normalizeProviderServiceAreaRadius(1)).toBe(1);
    expect(normalizeProviderServiceAreaRadius(300)).toBe(300);
    expect(normalizeProviderServiceAreaRadius(0)).toBeNull();
    expect(normalizeProviderServiceAreaRadius(301)).toBeNull();
    expect(normalizeProviderServiceAreaRadius("")).toBeNull();
    expect(normalizeProviderServiceAreaRadius(null)).toBeNull();
    expect(normalizeProviderServiceAreaRadius("abc")).toBeNull();
  });
});
