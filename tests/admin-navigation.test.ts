import { describe, expect, it } from "vitest";

import {
  canAccessAdminArea,
  getAdminNavigationItems,
  resolveAdminArea,
} from "../src/lib/admin-navigation";

describe("admin navigation policy", () => {
  it("gives super admins every admin area", () => {
    expect(getAdminNavigationItems("super_admin").map((item) => item.area)).toEqual([
      "saas",
      "workspaces",
      "billing",
      "platform_admins",
      "audit",
      "quote_admin",
    ]);
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

  it("maps nested routes to the same server-side area", () => {
    expect(resolveAdminArea("/admin/billing/alerts")).toBe("billing");
    expect(resolveAdminArea("/admin/workspaces/11111111-1111-4111-8111-111111111111")).toBe("workspaces");
    expect(resolveAdminArea("/admin/platform-admins")).toBe("platform_admins");
    expect(resolveAdminArea("/admin/status")).toBe("quote_admin");
    expect(resolveAdminArea("/admin")).toBe("quote_admin");
  });
});
