import { describe, expect, it } from "vitest";

import {
  canAccessAdminArea,
  getAdminNavigationItems,
} from "../src/lib/admin-access-policy";

describe("admin access policy", () => {
  it("keeps core operational pages available to every active platform role", () => {
    for (const role of [
      "super_admin",
      "support_admin",
      "billing_admin",
      "operations_admin",
      "read_only_admin",
      "developer_admin",
    ] as const) {
      expect(canAccessAdminArea(role, "saas")).toBe(true);
      expect(canAccessAdminArea(role, "workspaces")).toBe(true);
      expect(canAccessAdminArea(role, "audit")).toBe(true);
    }
  });

  it("restricts billing and platform role management", () => {
    expect(canAccessAdminArea("super_admin", "billing")).toBe(true);
    expect(canAccessAdminArea("billing_admin", "billing")).toBe(true);
    expect(canAccessAdminArea("operations_admin", "billing")).toBe(false);
    expect(canAccessAdminArea("super_admin", "platform_admins")).toBe(true);
    expect(canAccessAdminArea("billing_admin", "platform_admins")).toBe(false);
  });

  it("restricts quote operations and legacy company administration", () => {
    expect(canAccessAdminArea("super_admin", "quote")).toBe(true);
    expect(canAccessAdminArea("operations_admin", "quote")).toBe(true);
    expect(canAccessAdminArea("support_admin", "quote")).toBe(false);
    expect(canAccessAdminArea("super_admin", "company")).toBe(true);
    expect(canAccessAdminArea("operations_admin", "company")).toBe(false);
  });

  it("never renders links the role cannot open", () => {
    expect(getAdminNavigationItems("billing_admin").map((item) => item.area)).toEqual([
      "saas",
      "workspaces",
      "billing",
      "audit",
    ]);
    expect(getAdminNavigationItems("operations_admin").map((item) => item.area)).toEqual([
      "saas",
      "workspaces",
      "audit",
      "quote",
    ]);
    expect(getAdminNavigationItems("super_admin").map((item) => item.area)).toEqual([
      "saas",
      "workspaces",
      "billing",
      "platform_admins",
      "audit",
      "quote",
    ]);
  });
});
