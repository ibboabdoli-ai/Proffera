import { describe, expect, it } from "vitest";
import { isCustomerPortalSelfServicePath, resolvedCustomerPortalShellLanguage } from "./customer-portal-shell";

describe("customer portal language and shell isolation", () => {
  it("only matches a self-service page, including rescheduling", () => {
    expect(isCustomerPortalSelfServicePath("/mina-bokningar/example")).toBe(true);
    expect(isCustomerPortalSelfServicePath("/mina-bokningar/example/appointment/boka-om")).toBe(true);
    expect(isCustomerPortalSelfServicePath("/mina-bokningar/")).toBe(false);
    expect(isCustomerPortalSelfServicePath("/boka/example")).toBe(false);
    expect(isCustomerPortalSelfServicePath("/")).toBe(false);
  });
  it("uses the language rendered by the route", () => {
    expect(resolvedCustomerPortalShellLanguage("/mina-bokningar/example", "ar")).toBe("ar");
    expect(resolvedCustomerPortalShellLanguage("/mina-bokningar/example", "sv")).toBe("sv");
    expect(resolvedCustomerPortalShellLanguage("/mina-bokningar/example", "en")).toBe("en");
    expect(resolvedCustomerPortalShellLanguage("/mina-bokningar/example", "fa")).toBeNull();
    expect(resolvedCustomerPortalShellLanguage("/", "ar")).toBeNull();
  });
});
