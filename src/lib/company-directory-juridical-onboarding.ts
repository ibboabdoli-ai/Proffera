import "server-only";

import { headers } from "next/headers";

import { isBolagsverketJuridicalOrganizationNumber } from "@/lib/bolagsverket-api-policy";
import { upsertCompanyDirectoryCandidate } from "@/lib/company-directory-engine";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import type { NormalizedDirectoryCandidate } from "@/lib/company-directory-policy";
import { normalizeSwedishOrganizationNumber } from "@/lib/company-directory-provider-activation-policy";
import { autoPublishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";
import { verifyOfficialCompanyCandidate } from "@/lib/company-directory-source";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export type JuridicalDirectoryProfileState = {
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

export type JuridicalCompanyDirectoryOnboardingResult = {
  profile: JuridicalDirectoryProfileState | null;
  companyName: string;
  existed: boolean;
};

type OnboardingSource = "owner_onboarding" | "admin_onboarding";

type LookupBudget = {
  scope: string;
  identity: string;
};

function seedCandidate(
  organizationNumber: string,
  source: OnboardingSource,
): NormalizedDirectoryCandidate {
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
    officialSource: `bolagsverket_vardefulla_datamangder:${source}`,
    sourceRecordId: organizationNumber,
    sourceUpdatedAt: null,
  };
}

function profileState(row: Record<string, unknown>): JuridicalDirectoryProfileState {
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

async function lookupProfileState(
  organizationNumber: string,
): Promise<JuridicalDirectoryProfileState | null> {
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
  return rows[0]?.id ? profileState(rows[0] as Record<string, unknown>) : null;
}

async function lookupProfileStateById(
  profileId: string,
): Promise<JuridicalDirectoryProfileState | null> {
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
  return rows[0]?.id ? profileState(rows[0] as Record<string, unknown>) : null;
}

function canResumeReadyProfile(profile: JuridicalDirectoryProfileState) {
  return profile.publicationStatus === "ready"
    && profile.organizationKind === "juridical_person"
    && profile.isActive
    && !profile.privacyBlocked
    && profile.autoPublicEligible
    && !profile.claimedWorkspaceId
    && !profile.claimReservationId;
}

async function requireExternalLookupBudget(input: LookupBudget) {
  const identity = input.identity.trim();
  if (!identity) throw new Error("rate_limit_identity");

  const allowed = await allowPublicSubmission({
    scope: input.scope,
    requestHeaders: await headers(),
    identity,
    maxAttempts: 6,
    windowSeconds: 60 * 60,
  });
  if (!allowed) throw new Error("rate_limited");
}

/**
 * Workspace-neutral juridical-company ingestion.
 *
 * Authorization is deliberately owned by the caller. This helper never accepts
 * or resolves a Workspace and never links ownership. It only verifies a Swedish
 * juridical organisation, upserts the canonical Directory profile, enriches
 * Official Facts and uses the existing publication-safety gate.
 */
export async function onboardJuridicalCompanyDirectoryByOrganizationNumber(input: {
  organizationNumber: unknown;
  rateLimit: LookupBudget;
  source: OnboardingSource;
}): Promise<JuridicalCompanyDirectoryOnboardingResult> {
  const organizationNumber = normalizeSwedishOrganizationNumber(input.organizationNumber);
  if (!organizationNumber) throw new Error("organization_number");
  if (!isBolagsverketJuridicalOrganizationNumber(organizationNumber)) {
    throw new Error("private_identity");
  }

  const existing = await lookupProfileState(organizationNumber);
  if (existing) {
    if (!canResumeReadyProfile(existing)) {
      return { profile: existing, companyName: existing.companyName, existed: true };
    }

    await requireExternalLookupBudget(input.rateLimit);
    await enrichCompanyDirectoryOfficialFactsForProfile(existing.profileId);
    await autoPublishCompanyDirectoryProfileIfSafe(existing.profileId);

    const refreshed = await lookupProfileStateById(existing.profileId);
    return {
      profile: refreshed,
      companyName: refreshed?.companyName ?? existing.companyName,
      existed: true,
    };
  }

  await requireExternalLookupBudget(input.rateLimit);
  const verified = await verifyOfficialCompanyCandidate(
    seedCandidate(organizationNumber, input.source),
  );
  const companyName = String(verified.displayName || verified.legalName || "").trim();

  if (verified.organizationKind !== "juridical_person") {
    return { profile: null, companyName, existed: false };
  }

  const upserted = await upsertCompanyDirectoryCandidate(verified);
  await enrichCompanyDirectoryOfficialFactsForProfile(upserted.profileId);

  if (upserted.publicationStatus === "ready") {
    await autoPublishCompanyDirectoryProfileIfSafe(upserted.profileId);
  }

  const refreshed = await lookupProfileStateById(upserted.profileId);
  return { profile: refreshed, companyName, existed: false };
}
