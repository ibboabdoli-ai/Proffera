import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Admin mutation audit contracts", () => {
  it("keeps Quote Admin status changes authorized, atomic and audited", () => {
    const actionCode = source("src/features/admin/actions.ts");
    const mutationCode = source("src/features/admin/quote-request-status.ts");

    expect(actionCode).toContain('getAdminForArea("quote_admin")');
    expect(actionCode).toContain("persistQuoteRequestStatusChange");
    expect(mutationCode).toContain("for update");
    expect(mutationCode).toContain("p.status <> ${nextStatus}");
    expect(mutationCode).toContain("insert into admin_audit_logs");
    expect(mutationCode).toContain("'quote_request.status_updated'");
    expect(mutationCode).toContain("previous_value, new_value");
    expect(mutationCode).toContain("'status', previous_status");
    expect(mutationCode).toContain("'status', next_status");
  });

  it("keeps Company Admin mutations super-admin-only and audited", () => {
    const code = source("src/app/api/company-admin/route.ts");
    const authorizationIndex = code.indexOf("const admin = await getCompanyAdmin()");
    const formDataIndex = code.indexOf("const formData = await request.formData()");

    expect(authorizationIndex).toBeGreaterThan(-1);
    expect(formDataIndex).toBeGreaterThan(authorizationIndex);
    expect(code).toContain("sql.transaction((tx) =>");
    expect(code).toContain("'company.registration_updated'");
    expect(code).toContain("previous_value, new_value");
  });

  it("keeps legacy manual Billing changes blocked and audited", () => {
    const code = source("src/app/api/company-admin/route.ts");

    expect(code).toContain('if (action === "workspace_access")');
    expect(code).toContain("'billing.manual_change_blocked'");
    expect(code).toContain("Stripe is the source of truth");
    expect(code).not.toContain("update workspace_plans");
    expect(code).not.toContain("insert into workspace_feature_flags");
  });
});
