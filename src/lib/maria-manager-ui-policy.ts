/**
 * Maria Preview has a dedicated, transaction-locked hours editor at
 * /dashboard/maria#tider. The generic settings writer rejects Maria in
 * Preview and Production; never offer a save that cannot succeed.
 */
export function isMariaGenericBookingHoursReadOnly(
  workspaceSlug: string,
  vercelEnv: string | undefined,
): boolean {
  return workspaceSlug === "makeup-by-maria" && (vercelEnv === "preview" || vercelEnv === "production");
}

/**
 * Maria booking detail writes are permitted in isolated Preview only.
 * Preserve ordinary booking actions for other workspaces.
 */
export function isMariaBookingDetailReadOnly(
  workspaceSlug: string,
  vercelEnv: string | undefined,
): boolean {
  return workspaceSlug === "makeup-by-maria" && vercelEnv !== "preview";
}
