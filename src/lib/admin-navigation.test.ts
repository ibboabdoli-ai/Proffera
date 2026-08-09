import { describe, expect, it } from "vitest";

import {
  canAccessAdminArea,
  getAdminNavigationItems,
  resolveAdminArea,
} from "@/lib/admin-navigation";

describe("admin navigation", () => {
  it("routes company administration to its own protected area", () => {
    expect(resolveAdminArea("/admin/foretag")).toBe("company_admin");
    expect(resolveAdminArea("/admin/foretag/claims")).toBe("company_admin");
  });

  it("shows company administration only to super admins", () => {
    expect(canAccessAdminArea("super_admin", "company_admin")).toBe(true);
    expect(canAccessAdminArea("support_admin", "company_admin")).toBe(false);
    expect(canAccessAdminArea("operations_admin", "company_admin")).toBe(false);
    expect(getAdminNavigationItems("super_admin").some((item) => item.area === "company_admin")).toBe(true);
    expect(getAdminNavigationItems("support_admin").some((item) => item.area === "company_admin")).toBe(false);
  });
});
