/**
 * Feature-flag intent for a coordinated Maria Production release.
 *
 * This PURE policy is not a booking authorization decision: before enabling
 * anything, the server must also prove workspace entitlement, canonical
 * schema, published services, email delivery, owner permissions, and the
 * exact trusted hostname. Existing Preview-only booking APIs remain closed
 * in Production until their entire customer/OTP/manager path is reviewed.
 */
export const MARIA_CANONICAL_PRODUCTION_ORIGIN = "https://makeupbymaria.se" as const;

export type MariaProductionActivationBlocker =
  | "not_production"
  | "site_not_enabled"
  | "booking_not_enabled"
  | "manager_not_enabled"
  | "email_not_enabled"
  | "editor_not_enabled"
  | "canonical_origin_mismatch";

export function inspectMariaProductionActivationRequest(
  env: NodeJS.ProcessEnv = process.env,
): {
  requested: boolean;
  blockers: MariaProductionActivationBlocker[];
  portalOrigin: typeof MARIA_CANONICAL_PRODUCTION_ORIGIN | null;
} {
  const blockers: MariaProductionActivationBlocker[] = [];

  if (env.VERCEL_ENV !== "production") blockers.push("not_production");
  if (env.PROFFERA_MARIA_PUBLIC_SITE_ENABLED !== "true") blockers.push("site_not_enabled");
  if (env.PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED !== "true") blockers.push("booking_not_enabled");
  if (env.PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED !== "true") blockers.push("manager_not_enabled");
  if (env.PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED !== "true") blockers.push("email_not_enabled");
  if (env.PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED !== "true") blockers.push("editor_not_enabled");
  if (env.PROFFERA_MARIA_PRODUCTION_ORIGIN !== MARIA_CANONICAL_PRODUCTION_ORIGIN) {
    blockers.push("canonical_origin_mismatch");
  }

  return {
    requested: blockers.length === 0,
    blockers,
    portalOrigin: blockers.length === 0 ? MARIA_CANONICAL_PRODUCTION_ORIGIN : null,
  };
}
