import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canActivatePlatformAdmin,
  PlatformAdminManagementError,
} from "../src/lib/platform-admin-assignment-policy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Platform Admin workspace separation", () => {
  it("blocks a new active admin when the account belongs to a Workspace", () => {
    expect(canActivatePlatformAdmin({
      requestedActive: true,
      existingActive: false,
      workspaceMembershipCount: 1,
    })).toBe(false);
  });

  it("blocks reactivation of an inactive admin that now belongs to a Workspace", () => {
    expect(canActivatePlatformAdmin({
      requestedActive: true,
      existingActive: false,
      workspaceMembershipCount: 2,
    })).toBe(false);
  });

  it("allows role maintenance for an already active grandfathered admin", () => {
    expect(canActivatePlatformAdmin({
      requestedActive: true,
      existingActive: true,
      workspaceMembershipCount: 2,
    })).toBe(true);
  });

  it("allows deactivation regardless of Workspace membership", () => {
    expect(canActivatePlatformAdmin({
      requestedActive: false,
      existingActive: true,
      workspaceMembershipCount: 3,
    })).toBe(true);
  });

  it("allows a dedicated internal account without Workspace membership", () => {
    expect(canActivatePlatformAdmin({
      requestedActive: true,
      existingActive: false,
      workspaceMembershipCount: 0,
    })).toBe(true);
  });

  it("provides a stable error code for the server action", () => {
    const error = new PlatformAdminManagementError("workspace_member");
    expect(error.code).toBe("workspace_member");
    expect(error.name).toBe("PlatformAdminManagementError");
  });

  it("enforces the membership check again inside the audited SQL mutation", () => {
    const management = source("src/lib/platform-admin-management.ts");
    const action = source("src/app/admin/platform-admins/actions.ts");
    const page = source("src/app/admin/platform-admins/page.tsx");

    const policyCheck = management.indexOf("canActivatePlatformAdmin");
    const mutation = management.indexOf("const mutationRows");
    const serializedEligibility = management.indexOf("eligibility as materialized");
    const auditedMutation = management.indexOf("audited as");

    expect(policyCheck).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(policyCheck);
    expect(serializedEligibility).toBeGreaterThan(mutation);
    expect(auditedMutation).toBeGreaterThan(serializedEligibility);
    expect(management).toContain("from workspace_memberships wm");
    expect(management).toContain("current_target.has_workspace_membership");
    expect(management).toContain("then 'workspace_member'");
    expect(management).toContain("from eligibility\n      where outcome = 'ok'");
    expect(management).toContain("insert into admin_audit_logs");
    expect(management).toContain('outcome === "workspace_member"');
    expect(action).toContain("error instanceof PlatformAdminManagementError");
    expect(action).toContain("error=${error.code}");
    expect(page).toContain("workspace_member");
    expect(page).toContain("separat internt konto");
  });
});
