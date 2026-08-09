import { describe, expect, it } from "vitest";

import {
  canAccessAdminArea,
  canAccessCompanyAdmin,
  getAdminNavigationItems,
  resolveAdminArea,
} from "../src/lib/admin-navigation";

describe("admin navigation policy", () => {
  it("gives super admins every navigation area", () => {
    expect(getAdminNavigationItems("super_admin").map((item) => item.area)).toEqual([
      "saas",
      "operations",
      "workspaces",
      "company_admin",
      "billing",
      "platform_admins",
      "audit",
      "quote_admin",
    ]);
  });

  it("makes read-only operations health visible to every platform admin role", () => {
    expect(canAccessAdminArea("super_admin", "operations")).toBe(true);
    expect(canAccessAdminArea("support_admin", "operations")).toBe(true);
    expect(canAccessAdminArea("billing_admin", "operations")).toBe(true);
    expect(canAccessAdminArea("operations_admin", "operations")).toBe(true);
    expect(canAccessAdminArea("read_only_admin", "operations")).toBe(true);
    expect(canAccessAdminArea("developer_admin", "operations")).toBe(true);
  });

  it("limits billing and platform administration by role", () => {
    expect(canAccessAdminArea("billing_admin", "billing")).toBe(true);
    expect(canAccessAdminArea("operations_admin", "billing")).toBe(false);
    expect(canAccessAdminArea("billing_admin", "platform_admins")).toBe(false);
    expect(canAccessAdminArea("super_admin", "platform_admins")).toBe(true);
  });

  it("keeps quote operations away from read-only and specialist roles", () => {
    expect(canAccessAdminArea("operations_admin", "quote_admin")).toBe(true);
    expect(canAccessAdminArea("developer_admin", "quote_admin")).toBe(true);
    expect(canAccessAdminArea("support_admin", "quote_admin")).toBe(false);
    expect(canAccessAdminArea("billing_admin", "quote_admin")).toBe(false);
    expect(canAccessAdminArea("read_only_admin", "quote_admin")).toBe(false);
  });

  it("keeps company administration super-admin only", () => {
    expect(canAccessCompanyAdmin("super_admin")).toBe(true);
    expect(canAccessCompanyAdmin("operations_admin")).toBe(false);
    expect(canAccessCompanyAdmin("developer_admin")).toBe(false);
    expect(canAccessAdminArea("super_admin", "company_admin")).toBe(true);
    expect(canAccessAdminArea("support_admin", "company_admin")).toBe(false);
  });

  it("maps nested routes to the same server-side area", () => {
    expect(resolveAdminArea("/admin/billing/alerts")).toBe("billing");
    expect(resolveAdminArea("/admin/workspaces/11111111-1111-4111-8111-111111111111")).toBe("workspaces");
    expect(resolveAdminArea("/admin/foretag/claims")).toBe("company_admin");
    expect(resolveAdminArea("/admin/platform-admins")).toBe("platform_admins");
    expect(resolveAdminArea("/admin/status")).toBe("operations");
    expect(resolveAdminArea("/admin/status/details")).toBe("operations");
    expect(resolveAdminArea("/admin")).toBe("quote_admin");
  });
});
