import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migratedCustomerHex = /#(?:d9e1d7|17201a|17452f|e0e5dd|e4e9e2|f7f9f6|173e2b|0f3322|fff5f2|eef8f1)/i;

describe("Customer CRM UX 2.0", () => {
  it("keeps new-customer validation, access and persistence behavior intact", () => {
    const page = source("src/app/dashboard/kunder/ny/page.tsx");

    expect(page).toContain('hasDashboardModuleAccess("customer_crm")');
    expect(page).toContain("canManageWorkspaceSettings(workspaceAccess)");
    expect(page).toContain("createDashboardCustomer(customerInput)");
    expect(page).toContain('name="name"');
    expect(page).toContain('name="customer_type"');
    expect(page).toContain('name="status"');
    expect(page).toContain('name="email"');
    expect(page).toContain('name="phone"');
    expect(page).toContain('name="company_name"');
    expect(page).toContain('name="city"');
    expect(page).toContain('name="service_selection"');
    expect(page).toContain('name="notes"');
    expect(page).toContain("rounded-panel");
    expect(page).toContain("border-line");
    expect(page).toContain("bg-surface");
    expect(page).not.toMatch(migratedCustomerHex);
  });

  it("keeps customer-note tenant and permission boundaries while migrating presentation", () => {
    const page = source("src/app/dashboard/kunder/[id]/page.tsx");

    expect(page).toContain("getDashboardCustomerDetail(id)");
    expect(page).toContain('hasDashboardModuleAccess("customer_crm")');
    expect(page).toContain("canManageWorkspaceSettings(workspaceAccess)");
    expect(page).toContain("where workspace_id = ${workspaceId} and id = ${customerId}");
    expect(page).toContain("insert into customer_events");
    expect(page).toContain("jsonb_build_object('source', 'dashboard_manual')");
    expect(page).toContain('name="title"');
    expect(page).toContain('name="note"');
    expect(page).toContain("bg-brand-deep");
    expect(page).toContain("rounded-panel");
    expect(page).toContain("border-line");
    expect(page).not.toMatch(migratedCustomerHex);
  });
});
