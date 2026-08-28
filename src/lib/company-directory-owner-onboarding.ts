import "server-only";

import { headers } from "next/headers";

import { isBolagsverketJuridicalOrganizationNumber } from "@/lib/bolagsverket-api-policy";
import { upsertCompanyDirectoryCandidate } from "@/lib/company-directory-engine";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import {
  normalizeSwedishOrganizationNumber,
} from "@/lib/company-directory-provider-activation-policy";
import {
  autoPublishCompanyDirectoryProfileIfSafe,
} from "@/lib/company-directory-publication";
import {
  verifyOfficialCompanyCandidate,
} from "@/lib/company-directory-source";
import type { NormalizedDirectoryCandidate } from "@/lib/company-directory-policy";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type OwnerDirectoryOnboardingResult =
  | { status: "available"; profileSlug: string; companyName: string }
  | { status: "linked"; profileSlug: string; companyName: string }
  | { status: "claimed"; companyName: string }
  | { status: "busy"; companyName: string }
  | { status: "not_ready"; companyName?: string }
  | { status: "sole_trader_privacy"; companyName: string };

type ExistingProfileState = {
  profileId: string;
  profileSlug: string;
  companyName: string;
  publicationStatus: string;
  organizationKind: string;
  isActive: boolean;
  privacyBlocked: boolean;
  autoPublicEligible: boolean;
  claimedWorkspaceId: string;
  claimReservationId: string;
};

async function requireManageableWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("workspace_access");
  }
  return access;
}

function seedCandidate(organizationNumber: string): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber,
    organizationKind: "unknown",
    legalName: "",
    displayName: "",
    legalForm: "",
    organizationStatus: "",
    isActive: false,
    fTaxStatus: "",
    vatStatus: "",
    employerStatus: "",
    primarySniCode: "",
    primarySniLabel: "",
    activityDescription: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    municipality: "",
    region: "",
    officialSource: "bolagsverket_vardefulla_datamangder:owner_onboarding",
    sourceRecordId: organizationNumber,
    sourceUpdatedAt: null,
  };
}

async function lookupProfileState(organizationNumber: string): Promise<ExistingProfileState | null> {
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  const rows = await sql`
    select
      profile.id::text,
      profile.public_slug,
      profile.display_name,
      profile.publication_status,
      profile.organization_kind,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text
    from company_directory_profiles profile
    where profile.country_code = 'SE'
      and profile.organization_number = ${organizationNumber}
    limit 1
  `;
  const row = rows[0];
  if (!row?.id) return null;

  return {
    profileId: String(row.id),
    profileSlug: String(row.public_slug ?? ""),
    companyName: String(row.display_name ?? ""),
    publicationStatus: String(row.publication_status ?? ""),
    organizationKind: String(row.organization_kind ?? ""),
    isActive: Boolean(row.is_active),
    privacyBlocked: Boolean(row.privacy_blocked),
    autoPublicEligible: Boolean(row.auto_public_eligible),
    claimedWorkspaceId: String(row.claimed_workspace_id ?? ""),
    claimReservationId: String(row.claim_reservation_id ?? ""),
  };
}

function resultForProfile(
  profile: ExistingProfileState,
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

async function requireExternalLookupBudget(input: { workspaceId: string; userId: string }) {
  const allowed = await allowPublicSubmission({
    scope: "owner_directory_onboarding",
    requestHeaders: await headers(),
    identity: `${input.workspaceId}:${input.userId}`,
    maxAttempts: 6,
    windowSeconds: 60 * 60,
  });
  if (!allowed) throw new Error("rate_limited");
}

async function resumeReadyProfile(profile: ExistingProfileState, workspaceId: string, userId: string) {
  if (
    profile.publicationStatus !== "ready"
    || profile.organizationKind !== "juridical_person"
    || !profile.isActive
    || profile.privacyBlocked
    || !profile.autoPublicEligible
    || profile.claimedWorkspaceId
    || profile.claimReservationId
  ) {
    return resultForProfile(profile, workspaceId);
  }

  await requireExternalLookupBudget({ workspaceId, userId });
  await enrichCompanyDirectoryOfficialFactsForProfile(profile.profileId);
  await autoPublishCompanyDirectoryProfileIfSafe(profile.profileId);

  const refreshed = await lookupProfileStateById(profile.profileId);
  return refreshed ? resultForProfile(refreshed, workspaceId) : { status: "not_ready", companyName: profile.companyName };
}

async function lookupProfileStateById(profileId: string): Promise<ExistingProfileState | null> {
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");
  const rows = await sql`
    select
      profile.id::text,
      profile.public_slug,
      profile.display_name,
      profile.publication_status,
      profile.organization_kind,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text
    from company_directory_profiles profile
    where profile.id = ${profileId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row?.id) return null;
  return {
    profileId: String(row.id),
    profileSlug: String(row.public_slug ?? ""),
    companyName: String(row.display_name ?? ""),
    publicationStatus: String(row.publication_status ?? ""),
    organizationKind: String(row.organization_kind ?? ""),
    isActive: Boolean(row.is_active),
    privacyBlocked: Boolean(row.privacy_blocked),
    autoPublicEligible: Boolean(row.auto_public_eligible),
    claimedWorkspaceId: String(row.claimed_workspace_id ?? ""),
    claimReservationId: String(row.claim_reservation_id ?? ""),
  };
}

/**
 * Owner-initiated Directory ingestion for a real Swedish company that is not
 * already present locally. The official source remains authoritative; the user
 * cannot supply free-text company identity fields.
 *
 * Personnummer-shaped identifiers deliberately stop before any generic profile
 * lookup, external juridical-company request or persistence. A sole-trader owner
 * must use the dedicated privacy-safe verification path once that next slice is
 * implemented.
 */
export async function onboardOwnerCompanyByOrganizationNumber(
  value: unknown,
): Promise<OwnerDirectoryOnboardingResult> {
  const access = await requireManageableWorkspace();
  const organizationNumber = normalizeSwedishOrganizationNumber(value);
  if (!organizationNumber) throw new Error("organization_number");

  if (!isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    return { status: "sole_trader_privacy", companyName: "" };
  }

  const existing = await lookupProfileState(organizationNumber);
  if (existing) {
    const current = resultForProfile(existing, access.workspaceId);
    if (current.status !== "not_ready") return current;
    return resumeReadyProfile(existing, access.workspaceId, access.userId);
  }

  await requireExternalLookupBudget({ workspaceId: access.workspaceId, userId: access.userId });
  const verified = await verifyOfficialCompanyCandidate(seedCandidate(organizationNumber));
  const companyName = String(verified.displayName || verified.legalName || "").trim();

  if (verified.organizationKind !== "juridical_person") {
    return { status: "not_ready", companyName };
  }

  const upserted = await upsertCompanyDirectoryCandidate(verified);
  await enrichCompanyDirectoryOfficialFactsForProfile(upserted.profileId);

  if (upserted.publicationStatus === "ready") {
    await autoPublishCompanyDirectoryProfileIfSafe(upserted.profileId);
  }

  const refreshed = await lookupProfileStateById(upserted.profileId);
  return refreshed ? resultForProfile(refreshed, access.workspaceId) : { status: "not_ready", companyName };
}
