export const workspaceRoles = ["owner", "admin", "staff", "viewer"] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && workspaceRoles.includes(value as WorkspaceRole);
}

export function canRoleManageWorkspaceSettings(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canRoleManageWorkspaceMembers(role: WorkspaceRole) {
  return role === "owner";
}
