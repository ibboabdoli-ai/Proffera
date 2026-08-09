import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public Business Hub analytics contract", () => {
  it("keeps analytics scoped to the authenticated active workspace", () => {
    const analytics = source("src/lib/dashboard-public-business-analytics.ts");

    expect(analytics).toContain("getUserWorkspaceAccess");
    expect(analytics).toContain("workspace_id = ${access.workspaceId}::uuid");
    expect(analytics).toContain("service.workspace_id = ${access.workspaceId}");
    expect(analytics).not.toContain("customer_email");
    expect(analytics).not.toContain("customer_phone");
  });

  it("uses existing non-PII funnel events without adding a reporting schema", () => {
    const analytics = source("src/lib/dashboard-public-business-analytics.ts");

    expect(analytics).toContain("from public_business_events");
    expect(analytics).toContain("'business_view'");
    expect(analytics).toContain("'service_view'");
    expect(analytics).toContain("'book_clicked'");
    expect(analytics).toContain("'quote_clicked'");
    expect(analytics).toContain("'contact_clicked'");
    expect(analytics).toContain("safeDays");
  });

  it("gates the dashboard surface with the canonical analytics entitlement", () => {
    const modules = source("src/lib/proffera-modules.ts");
    const page = source("src/app/dashboard/analys/page.tsx");
    const shell = source("src/components/dashboard/dashboard-shell.tsx");

    expect(modules).toContain('{ label: "Analys", href: "/dashboard/analys", featureKey: "analytics" }');
    expect(page).toContain('hasDashboardFeatureAccess("analytics")');
    expect(shell).toContain('"/dashboard/analys": BarChart3');
    expect(shell).toContain('"/dashboard/analys": "Analytics"');
  });

  it("shows a 30-day conversion overview and service ranking", () => {
    const page = source("src/app/dashboard/analys/page.tsx");

    expect(page).toContain("getDashboardPublicBusinessAnalytics(30)");
    expect(page).toContain("summary.actionRate.toFixed(1)");
    expect(page).toContain("service.actions");
    expect(page).toContain("No personal customer details are shown here.");
  });
});
