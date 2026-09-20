import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveCustomerPortalLanguage } from "./customer-portal-language";

const base = {
  publicBookingSlug: "test",
  companyName: "Test AB",
  defaultLanguage: "en" as const,
  swedishEnabled: true,
  englishEnabled: true,
  primaryColor: "#0a2e63",
  logoUrl: "",
};

describe("resolveCustomerPortalLanguage", () => {
  it("honors an enabled requested locale", () => {
    expect(resolveCustomerPortalLanguage("en", base)).toBe("en");
    expect(resolveCustomerPortalLanguage("sv", base)).toBe("sv");
  });

  it("falls back to an enabled locale when the request is disabled", () => {
    expect(resolveCustomerPortalLanguage("en", {
      ...base,
      englishEnabled: false,
      swedishEnabled: true,
    })).toBe("sv");
    expect(resolveCustomerPortalLanguage("sv", {
      ...base,
      defaultLanguage: "sv",
      englishEnabled: true,
      swedishEnabled: false,
    })).toBe("en");
  });

  it("fails closed to Swedish when language settings are unusable", () => {
    expect(resolveCustomerPortalLanguage("en", {
      ...base,
      swedishEnabled: false,
      englishEnabled: false,
    })).toBe("sv");
    expect(resolveCustomerPortalLanguage(undefined, null)).toBe("sv");
  });
});
