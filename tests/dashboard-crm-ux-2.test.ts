import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migratedCoreHex = /#(?:f6f8f4|dfe5dd|17452f|17201a|5b665f|102a1c|eef5ef|173e2b)/i;

describe("Dashboard and CRM UX 2.0", () => {
  it("uses Design System 2.0 tokens in shared dashboard primitives", () => {
    const ui = source("src/components/dashboard/dashboard-page-ui.tsx");
    expect(ui).toContain("rounded-card");
    expect(ui).toContain("border-line");
    expect(ui).toContain("bg-surface");
    expect(ui).toContain("text-ink");
    expect(ui).toContain("text-ink-muted");
    expect(ui).toContain("shadow-card");
    expect(ui).not.toMatch(migratedCoreHex);
  });

  it("keeps dashboard access and statistics behavior while migrating presentation", () => {
    const dashboard = source("src/app/dashboard/page.tsx");
    expect(dashboard).toContain("getDashboardModuleAccess()");
    expect(dashboard).toContain("getDashboardEnabledFeatureKeys()");
    expect(dashboard).toContain("getUserWorkspaceAccess()");
    expect(dashboard).toContain("getDashboardStats({ includeCustomers: canUseCrm, includeBookings: canUseBooking })");
    expect(dashboard).toContain("canManageWorkspaceSettings(workspaceAccess)");
    expect(dashboard).toContain("bg-brand-deep");
    expect(dashboard).toContain("rounded-panel");
    expect(dashboard).not.toMatch(migratedCoreHex);
  });

  it("preserves lead and CRM data access while unifying their visual system", () => {
    const leads = source("src/app/dashboard/leads/page.tsx");
    const customers = source("src/app/dashboard/kunder/page.tsx");

    expect(leads).toContain("getDashboardLeads()");
    expect(leads).toContain('hasDashboardModuleAccess("customer_crm")');
    expect(leads).toContain('hasDashboardModuleAccess("online_booking")');
    expect(customers).toContain("getDashboardCustomers()");

    for (const page of [leads, customers]) {
      expect(page).toContain("DashboardPageHeader");
      expect(page).toContain("DashboardMetricGrid");
      expect(page).toContain("DashboardDataPanel");
      expect(page).toContain("bg-brand-deep");
      expect(page).toContain("border-line");
      expect(page).not.toMatch(migratedCoreHex);
    }
  });
});
