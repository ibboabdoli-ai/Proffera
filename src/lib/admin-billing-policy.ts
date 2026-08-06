import type { PlatformAdminRole } from "@/lib/platform-admin";

export const BILLING_ADMIN_ROLES: readonly PlatformAdminRole[] = ["super_admin", "billing_admin"];
export const TRIAL_EXTENSION_DAY_OPTIONS = [3, 7, 14, 30] as const;

export type TrialExtensionDays = (typeof TRIAL_EXTENSION_DAY_OPTIONS)[number];

export function canAccessAdminBilling(role: PlatformAdminRole) {
  return BILLING_ADMIN_ROLES.includes(role);
}

export function parseTrialExtensionDays(value: string): TrialExtensionDays {
  const days = Number(value);
  if (!TRIAL_EXTENSION_DAY_OPTIONS.includes(days as TrialExtensionDays)) {
    throw new Error("Invalid trial extension duration");
  }
  return days as TrialExtensionDays;
}

export function normalizeTrialExtensionReason(value: string) {
  const reason = value.trim();
  if (reason.length < 8 || reason.length > 500) {
    throw new Error("A reason between 8 and 500 characters is required");
  }
  return reason;
}
