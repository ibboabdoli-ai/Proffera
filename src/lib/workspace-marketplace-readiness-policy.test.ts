import { describe, expect, it } from "vitest";

import { resolveMarketplaceReadiness } from "./workspace-marketplace-readiness-policy";

function service(overrides: Partial<{
  isActive: boolean;
  publicStatus: string;
  conversionMode: string;
  serviceArea: string;
}> = {}) {
  return {
    isActive: true,
    publicStatus: "published",
    conversionMode: "quote",
    serviceArea: "Södertälje",
    ...overrides,
  };
}

const base = {
  claimVerified: true,
  contactEmailValid: true,
  leadManagementAccess: true,
  services: [service()],
};

describe("workspace marketplace readiness", () => {
  it("is ready only when every lead-safety boundary is satisfied", () => {
    expect(resolveMarketplaceReadiness(base)).toEqual({
      claimReady: true,
      contactReady: true,
      entitlementReady: true,
      leadServiceReady: true,
      serviceAreaReady: true,
      ready: true,
    });
  });

  it("keeps an active draft service out of marketplace readiness", () => {
    const result = resolveMarketplaceReadiness({ ...base, services: [service({ publicStatus: "draft" })] });
    expect(result.leadServiceReady).toBe(false);
    expect(result.serviceAreaReady).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("keeps a published booking-only service out of lead readiness", () => {
    const result = resolveMarketplaceReadiness({ ...base, services: [service({ conversionMode: "book" })] });
    expect(result.leadServiceReady).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("requires an explicit service area on a lead-capable published service", () => {
    const result = resolveMarketplaceReadiness({ ...base, services: [service({ serviceArea: "" })] });
    expect(result.leadServiceReady).toBe(true);
    expect(result.serviceAreaReady).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("does not substitute claim, contact or entitlement requirements", () => {
    expect(resolveMarketplaceReadiness({ ...base, claimVerified: false }).ready).toBe(false);
    expect(resolveMarketplaceReadiness({ ...base, contactEmailValid: false }).ready).toBe(false);
    expect(resolveMarketplaceReadiness({ ...base, leadManagementAccess: false }).ready).toBe(false);
  });
});
