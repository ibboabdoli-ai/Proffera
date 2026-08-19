import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Directory profile contact visibility", () => {
  it("renders all direct-contact labels while keeping locked profiles value-free", () => {
    const profileCode = source("src/components/company-directory/public-directory-profile.tsx");
    const dataCode = source("src/lib/company-directory-public-data.ts");

    expect(profileCode).toContain("{t.phone}");
    expect(profileCode).toContain("{t.email}");
    expect(profileCode).toContain("{t.website}");
    expect(profileCode).toContain("{t.address}");
    expect(profileCode).toContain("business.directContactUnlocked");
    expect(profileCode).toContain("LockKeyhole");

    expect(dataCode).toContain("hasWorkspaceActivePaidPlanAccessForWorkspace(workspaceId)");
    expect(dataCode).toContain("gateDirectoryDirectContact(rawContact, entitled)");
    expect(dataCode).toContain("directContactUnlocked: entitled");
    expect(dataCode).toContain("scb.phone");
    expect(dataCode).toContain("scb.email");
    expect(dataCode).toContain("profile.website_url");
  });

  it("requires an active paid plan rather than a trial to unlock public contact", () => {
    const entitlementCode = source("src/lib/workspace-feature-entitlement-db.ts");

    expect(entitlementCode).toContain("hasWorkspaceActivePaidPlanAccessForWorkspace");
    expect(entitlementCode).toContain('String(row.status ?? "") !== "active"');
    expect(entitlementCode).toContain('planStatus: "active"');
  });

  it("keeps raw contact available to super-admin without applying public entitlement", () => {
    const adminCode = source("src/lib/company-directory-admin.ts");

    expect(adminCode).toContain("await requireSuperAdmin()");
    expect(adminCode).toContain("scb.phone as scb_phone");
    expect(adminCode).toContain("scb.email as scb_email");
    expect(adminCode).toContain("p.address_line1, p.postal_code, p.website_url");
    expect(adminCode).toContain("Admin · Telefon:");
    expect(adminCode).toContain("Admin · E-post:");
    expect(adminCode).toContain("Admin · Webbplats:");
    expect(adminCode).toContain("Admin · Adress:");
    expect(adminCode).not.toContain("hasWorkspaceActivePaidPlanAccessForWorkspace");
  });
});
