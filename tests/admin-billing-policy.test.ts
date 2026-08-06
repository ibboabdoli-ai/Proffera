import { describe, expect, it } from "vitest";

import {
  canAccessAdminBilling,
  normalizeTrialExtensionReason,
  parseTrialExtensionDays,
} from "../src/lib/admin-billing-policy";

describe("admin billing policy", () => {
  it("only permits billing-capable platform roles", () => {
    expect(canAccessAdminBilling("super_admin")).toBe(true);
    expect(canAccessAdminBilling("billing_admin")).toBe(true);
    expect(canAccessAdminBilling("support_admin")).toBe(false);
    expect(canAccessAdminBilling("read_only_admin")).toBe(false);
  });

  it("accepts only the fixed trial extension durations", () => {
    expect(parseTrialExtensionDays("3")).toBe(3);
    expect(parseTrialExtensionDays("30")).toBe(30);
    expect(() => parseTrialExtensionDays("1")).toThrow("Invalid trial extension duration");
    expect(() => parseTrialExtensionDays("365")).toThrow("Invalid trial extension duration");
  });

  it("requires a meaningful bounded reason", () => {
    expect(normalizeTrialExtensionReason("  Customer needs extra onboarding time  ")).toBe("Customer needs extra onboarding time");
    expect(() => normalizeTrialExtensionReason("short")).toThrow("A reason between 8 and 500 characters is required");
    expect(() => normalizeTrialExtensionReason("x".repeat(501))).toThrow("A reason between 8 and 500 characters is required");
  });
});
