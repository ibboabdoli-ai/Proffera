import "server-only";

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
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type OwnerDirectoryOnboardingResult =
  | { status: "available"; profileSlug: string; companyName: string }
  | { status: "linked"; profileSlug: string; companyName: string }
  | { status: "claimed"; companyName: string }
  | { status: "busy"; companyName: string }
  | { status: "not_ready"; companyName?: string }
  | { status: "sole_trader_privacy"; companyName: string };

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
    primarySniVerified: false,
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

async function lookupExistingProfile(
  organizationNumber: string,
  workspaceId: string,
): Promise<OwnerDirectoryOnboardingResult | null> {
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");

  const rows = await sql`
    select
      profile.public_slug,
      profile.display_name,
      profile.publication_status,
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
  if (!row) return null;

  const companyName = String(row.display_name ?? "");
  const profileSlug = String(row.public_slug ?? "");
  const claimedWorkspaceId = String(row.claimed_workspace_id ?? "");
  if (claimedWorkspaceId === workspaceId) {
    return profileSlug
      ? { status: "linked", profileSlug, companyName }
      : { status: "not_ready", companyName };
  }
  if (claimedWorkspaceId) return { status: "claimed", companyName };
  if (row.claim_reservation_id) return { status: "busy", companyName };
  if (
    String(row.publication_status) !== "published"
    || !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || !Boolean(row.auto_public_eligible)
    || !profileSlug
  ) {
    return { status: "not_ready", companyName };
  }

  return { status: "available", profileSlug, companyName };
}

/**
 * Owner-initiated Directory ingestion for a real Swedish company that is not
 * already present locally. The official source remains authoritative; the user
 * cannot supply free-text company identity fields.
 *
 * Sole traders deliberately stop before persistence in this first slice. Their
 * identifier can be personnummer-shaped, so the generic juridical-person profile
 * path must not store/project it until the dedicated privacy-safe claim path is
 * implemented.
 */
export async function onboardOwnerCompanyByOrganizationNumber(
  value: unknown,
): Promise<OwnerDirectoryOnboardingResult> {
  const access = await requireManageableWorkspace();
  const organizationNumber = normalizeSwedishOrganizationNumber(value);
  if (!organizationNumber) throw new Error("organization_number");

  const existing = await lookupExistingProfile(organizationNumber, access.workspaceId);
  if (existing) return existing;

  const verified = await verifyOfficialCompanyCandidate(seedCandidate(organizationNumber));
  const companyName = String(verified.displayName || verified.legalName || "").trim();

  if (verified.organizationKind !== "juridical_person") {
    return verified.organizationKind === "sole_trader"
      ? { status: "sole_trader_privacy", companyName }
      : { status: "not_ready", companyName };
  }

  const upserted = await upsertCompanyDirectoryCandidate(verified);
  await enrichCompanyDirectoryOfficialFactsForProfile(upserted.profileId);

  if (upserted.publicationStatus === "ready") {
    await autoPublishCompanyDirectoryProfileIfSafe(upserted.profileId);
  }

  return await lookupExistingProfile(organizationNumber, access.workspaceId)
    ?? { status: "not_ready", companyName };
}
