import "server-only";

import { isBolagsverketJuridicalOrganizationNumber } from "@/lib/bolagsverket-api-policy";
import {
  onboardJuridicalCompanyDirectoryByOrganizationNumber,
  type JuridicalDirectoryProfileState,
} from "@/lib/company-directory-juridical-onboarding";
import {
  normalizeSwedishOrganizationNumber,
} from "@/lib/company-directory-provider-activation-policy";
import { onboardOwnerSoleTrader } from "@/lib/company-directory-sole-trader-owner";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type OwnerDirectoryOnboardingResult =
  | { status: "available"; profileSlug: string; companyName: string }
  | { status: "linked"; profileSlug: string; companyName: string }
  | { status: "claimed"; companyName: string }
  | { status: "busy"; companyName: string }
  | { status: "not_ready"; companyName?: string }
  | { status: "sole_trader_review_pending"; companyName: string }
  | { status: "sole_trader_linked"; profileSlug: string; companyName: string }
  | { status: "sole_trader_ambiguous"; companyName: string }
  | { status: "sole_trader_not_active"; companyName: string };

async function requireManageableWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("workspace_access");
  }
  return access;
}

function resultForProfile(
  profile: JuridicalDirectoryProfileState,
  workspaceId: string,
): OwnerDirectoryOnboardingResult {
  if (profile.claimedWorkspaceId === workspaceId) {
    return profile.profileSlug
      ? { status: "linked", profileSlug: profile.profileSlug, companyName: profile.companyName }
      : { status: "not_ready", companyName: profile.companyName };
  }
  if (profile.claimedWorkspaceId) return { status: "claimed", companyName: profile.companyName };
  if (profile.claimReservationId) return { status: "busy", companyName: profile.companyName };
  if (
    profile.publicationStatus !== "published"
    || !profile.isActive
    || profile.privacyBlocked
    || !profile.autoPublicEligible
    || !profile.profileSlug
  ) {
    return { status: "not_ready", companyName: profile.companyName };
  }

  return { status: "available", profileSlug: profile.profileSlug, companyName: profile.companyName };
}

/**
 * Owner-initiated Directory ingestion for a real Swedish company that is not
 * already present locally. Workspace authorization remains the first boundary.
 * Personnummer-shaped identities stay on the separate privacy-safe sole-trader
 * owner flow.
 */
export async function onboardOwnerCompanyByOrganizationNumber(
  value: unknown,
): Promise<OwnerDirectoryOnboardingResult> {
  const access = await requireManageableWorkspace();
  const organizationNumber = normalizeSwedishOrganizationNumber(value);
  if (!organizationNumber) throw new Error("organization_number");

  if (!isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    return onboardOwnerSoleTrader(value);
  }

  const result = await onboardJuridicalCompanyDirectoryByOrganizationNumber({
    organizationNumber,
    rateLimit: {
      scope: "owner_directory_onboarding",
      identity: `${access.workspaceId}:${access.userId}`,
    },
    source: "owner_onboarding",
  });

  return result.profile
    ? resultForProfile(result.profile, access.workspaceId)
    : { status: "not_ready", companyName: result.companyName };
}
