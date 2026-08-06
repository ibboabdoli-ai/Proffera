export const PLATFORM_ADMIN_MANAGEMENT_ERROR_CODES = [
  "invalid_email",
  "invalid_role",
  "user_not_found",
  "workspace_member",
  "self_protection",
  "last_super_admin",
  "access_revoked",
] as const;

export type PlatformAdminManagementErrorCode =
  (typeof PLATFORM_ADMIN_MANAGEMENT_ERROR_CODES)[number];

const errorMessages: Record<PlatformAdminManagementErrorCode, string> = {
  invalid_email: "Valid email required",
  invalid_role: "Invalid platform admin role",
  user_not_found: "User account not found",
  workspace_member: "Workspace members cannot be newly activated as platform admins",
  self_protection: "You cannot remove your own super admin access",
  last_super_admin: "The final active super admin cannot be deactivated or demoted",
  access_revoked: "Your super admin access changed before the update completed",
};

export class PlatformAdminManagementError extends Error {
  readonly code: PlatformAdminManagementErrorCode;

  constructor(code: PlatformAdminManagementErrorCode) {
    super(errorMessages[code]);
    this.name = "PlatformAdminManagementError";
    this.code = code;
  }
}

export function canActivatePlatformAdmin(input: {
  requestedActive: boolean;
  existingActive: boolean;
  workspaceMembershipCount: number;
}) {
  if (!input.requestedActive) return true;
  if (input.existingActive) return true;
  return input.workspaceMembershipCount === 0;
}
