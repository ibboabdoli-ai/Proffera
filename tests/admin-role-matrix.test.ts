import { describe, expect, it } from "vitest";

import {
  ADMIN_NAVIGATION_ITEMS,
  canAccessAdminArea,
  canAccessCompanyAdmin,
  getAdminNavigationItems,
  type AdminArea,
} from "../src/lib/admin-navigation";
import type { PlatformAdminRole } from "../src/lib/platform-admin";

const expectedAreas: Record<PlatformAdminRole, readonly AdminArea[]> = {
  super_admin: ["saas", "workspaces", "billing", "platform_admins", "audit", "quote_admin"],
  support_admin: ["saas", "workspaces", "audit"],
  billing_admin: ["saas", "workspaces", "billing", "audit"],
  operations_admin: ["saas", "workspaces", "audit", "quote_admin"],
  read_only_admin: ["saas", "workspaces", "audit"],
  developer_admin: ["saas", "workspaces", "audit", "quote_admin"],
};

const roles = Object.keys(expectedAreas) as PlatformAdminRole[];
const allAreas = ADMIN_NAVIGATION_ITEMS.map((item) => item.area);

describe("complete platform-admin role matrix", () => {
  for (const role of roles) {
    it(`${role} exposes exactly the authorized navigation areas`, () => {
      expect(getAdminNavigationItems(role).map((item) => item.area)).toEqual(expectedAreas[role]);
    });

    it(`${role} server policy matches the visible navigation`, () => {
      for (const area of allAreas) {
        expect(canAccessAdminArea(role, area)).toBe(expectedAreas[role].includes(area));
      }
    });
  }

  it("keeps legacy company administration super-admin only", () => {
    expect(canAccessCompanyAdmin("super_admin")).toBe(true);
    for (const role of roles.filter((value) => value !== "super_admin")) {
      expect(canAccessCompanyAdmin(role)).toBe(false);
    }
  });
});
