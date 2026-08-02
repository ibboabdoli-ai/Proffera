import { describe, expect, it } from "vitest";

import {
  canRoleManageWorkspaceMembers,
  canRoleManageWorkspaceSettings,
  isWorkspaceRole,
  workspaceRoles,
} from "./workspace-role-policy";

describe("workspace role policy", () => {
  it("keeps the supported role set explicit", () => {
    expect(workspaceRoles).toEqual(["owner", "admin", "staff", "viewer"]);
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("platform_admin")).toBe(false);
    expect(isWorkspaceRole(1)).toBe(false);
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["staff", false],
    ["viewer", false],
  ] as const)("settings permission for %s is %s", (role, expected) => {
    expect(canRoleManageWorkspaceSettings(role)).toBe(expected);
  });

  it.each([
    ["owner", true],
    ["admin", false],
    ["staff", false],
    ["viewer", false],
  ] as const)("member-management permission for %s is %s", (role, expected) => {
    expect(canRoleManageWorkspaceMembers(role)).toBe(expected);
  });
});
