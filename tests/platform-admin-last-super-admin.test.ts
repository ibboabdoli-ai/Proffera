import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PlatformAdminManagementError } from "../src/lib/platform-admin-assignment-policy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Final active Platform Super Admin invariant", () => {
  it("exposes stable errors for the global invariant and stale authorization", () => {
    expect(new PlatformAdminManagementError("last_super_admin")).toMatchObject({
      name: "PlatformAdminManagementError",
      code: "last_super_admin",
    });
    expect(new PlatformAdminManagementError("access_revoked")).toMatchObject({
      name: "PlatformAdminManagementError",
      code: "access_revoked",
    });
  });

  it("serializes role mutations before checking the active super admin set", () => {
    const management = source("src/lib/platform-admin-management.ts");

    const lock = management.indexOf("pg_advisory_xact_lock(74821, 34901)");
    const currentTarget = management.indexOf("current_target as materialized");
    const eligibility = management.indexOf("eligibility as materialized");
    const upsert = management.indexOf("upserted as");
    const audit = management.indexOf("audited as");

    expect(lock).toBeGreaterThan(-1);
    expect(currentTarget).toBeGreaterThan(lock);
    expect(eligibility).toBeGreaterThan(currentTarget);
    expect(upsert).toBeGreaterThan(eligibility);
    expect(audit).toBeGreaterThan(upsert);
    expect(management).toContain("from lock_guard");
  });

  it("blocks deactivation or demotion when no other active super admin exists", () => {
    const management = source("src/lib/platform-admin-management.ts");

    expect(management).toContain("current_target.existing_role = 'super_admin'");
    expect(management).toContain("current_target.existing_is_active");
    expect(management).toContain("not ${isActive} or ${role} <> 'super_admin'");
    expect(management).toContain("other.user_id <> current_target.user_id");
    expect(management).toContain("other.role = 'super_admin'");
    expect(management).toContain("other.is_active = true");
    expect(management).toContain("then 'last_super_admin'");
    expect(management).toContain('new PlatformAdminManagementError("last_super_admin")');
  });

  it("revalidates the acting super admin inside the same serialized statement", () => {
    const management = source("src/lib/platform-admin-management.ts");

    expect(management).toContain("as actor_is_super_admin");
    expect(management).toContain("actor.user_id = ${admin.userId}");
    expect(management).toContain("actor.role = 'super_admin'");
    expect(management).toContain("actor.is_active = true");
    expect(management).toContain("then 'access_revoked'");
  });

  it("persists the role change and audit only for an eligible outcome", () => {
    const management = source("src/lib/platform-admin-management.ts");
    const page = source("src/app/admin/platform-admins/page.tsx");

    expect(management).toContain("from eligibility\n      where outcome = 'ok'");
    expect(management).toContain("from upserted\n      join eligibility");
    expect(management).toContain("(select id from audited limit 1) as audit_id");
    expect(management).toContain("Platform admin update was not persisted and audited");
    expect(page).toContain("last_super_admin");
    expect(page).toContain("sista aktiva super_admin");
    expect(page).toContain("access_revoked");
  });
});
