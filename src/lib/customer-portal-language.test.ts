import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: () => mocks.sql }));
vi.mock("@/lib/customer-calendar", () => ({
  verifyCustomerCalendarToken: () => ({ workspaceId: "workspace-1" }),
}));
vi.mock("@/lib/db/database-url", () => ({ resolveDatabaseUrl: () => "postgres://test" }));

import { getCustomerPortalPresentation, resolveCustomerPortalLanguage } from "./customer-portal-language";

const base = {
  publicBookingSlug: "test",
  companyName: "Test AB",
  defaultLanguage: "en" as const,
  swedishEnabled: true,
  englishEnabled: true,
  primaryColor: "#0a2e63",
  logoUrl: "",
};

beforeEach(() => {
  mocks.sql.mockReset();
});

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

  it("keeps Maria Swedish, English and Arabic available only on an approved Production origin",()=>{
    const maria={...base,publicBookingSlug:"makeup-by-maria",defaultLanguage:"sv" as const,
      swedishEnabled:true,englishEnabled:false};
    vi.stubEnv("VERCEL_ENV","production");
    expect(resolveCustomerPortalLanguage("ar",maria)).toBe("sv");
    for(const [key,value] of Object.entries({
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN:"https://makeupbymaria.se",
    }))vi.stubEnv(key,value);
    expect(resolveCustomerPortalLanguage("ar",maria)).toBe("ar");
    expect(resolveCustomerPortalLanguage("en",maria)).toBe("en");
    expect(resolveCustomerPortalLanguage("sv",maria)).toBe("sv");
    expect(resolveCustomerPortalLanguage("ar",{...maria,publicBookingSlug:"other-business"})).toBe("sv");
    vi.unstubAllEnvs();
  });

  it("uses the canonical booking color when experience settings are absent", async () => {
    mocks.sql.mockResolvedValue([{
      public_booking_slug: "legacy",
      company_name: "Legacy AB",
      default_language: "sv",
      swedish_enabled: true,
      english_enabled: true,
      primary_color: "#17452f",
      logo_url: "",
    }]);

    const presentation = await getCustomerPortalPresentation("customer-token");
    const [strings] = mocks.sql.mock.calls[0] as [TemplateStringsArray];

    expect(strings.join("?")).toContain("coalesce(nullif(x.primary_color, ''), '#17452f')");
    expect(presentation?.primaryColor).toBe("#17452f");
  });
});
