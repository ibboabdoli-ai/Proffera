import "server-only";

import { randomUUID } from "node:crypto";

import { createWorkspaceSlug, provisionWorkspace } from "@/features/company/workspace-provisioning";
import {
  isClaimBusinessEmailVerified,
  parseClaimEmailEvidence,
  serializeClaimEmailEvidence,
} from "@/lib/company-directory-claim-email";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

const CLAIM_RESERVATION_LEASE_MINUTES = 15;

function safeUuid(value: string) {
  const cleaned = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  return admin;
}

export async function listCompanyDirectoryClaims(limit = 100) {
  const admin = await requireSuperAdmin();
  const sql = getSql();
  if (!sql) return { admin, rows: [] };
  const safeLimit = Math.max(1, Math.min(250, limit));

  const rows = await sql`
    select
      claim.id::text,
      claim.status,
      claim.verification_method,
      claim.verification_reference,
      claim.requested_at,
      claim.verified_at,
      claim.resolved_at,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.public_slug,
      profile.display_name,
      profile.legal_name,
      profile.legal_form,
      profile.city,
      profile.primary_sni_code,
      profile.primary_sni_label,
      profile.category_slug,
      profile.quality_score,
      profile.official_source,
      profile.source_updated_at,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      profile.claim_reserved_at,
      u.id as claimant_user_id,
      u.name as claimant_name,
      u.email as claimant_email,
      u."emailVerified" as claimant_email_verified
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" u on u.id = claim.claimant_user_id
    order by
      case claim.status when 'pending' then 0 when 'verified' then 1 when 'claimed' then 2 else 3 end,
      claim.requested_at desc
    limit ${safeLimit}
  `;

  return { admin, rows };
}

export async function rejectCompanyDirectoryClaim(input: { claimId: string; reason: string }) {
  const admin = await requireSuperAdmin();
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const claimId = safeUuid(input.claimId);
  if (!claimId) throw new Error("Invalid claim id");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("A short rejection reason is required");

  const rows = await sql`
    update company_directory_claims claim
    set status = 'rejected', resolved_at = now(), verification_reference = ${reason}
    where claim.id = ${claimId}::uuid
      and claim.status in ('pending', 'verified')
      and not exists (
        select 1
        from company_directory_profiles profile
        where profile.id = claim.profile_id
          and profile.claim_reservation_id = claim.id
      )
    returning claim.profile_id::text
  `;
  const profileId = String(rows[0]?.profile_id ?? "");
  if (!profileId) throw new Error("Claim is no longer rejectable or is being provisioned");

  await sql`
    insert into admin_audit_logs (admin_user_id, action, reason, previous_value, new_value)
    values (
      ${admin.userId}, 'company_directory.claim.rejected', ${reason},
      ${JSON.stringify({ claimId, profileId, status: "pending_or_verified" })}::jsonb,
      ${JSON.stringify({ claimId, profileId, status: "rejected" })}::jsonb
    )
  `;

  return { claimId, profileId };
}

export async function releaseStaleCompanyDirectoryClaimReservation(input: { claimId: string; reason: string }) {
  const admin = await requireSuperAdmin();
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const claimId = safeUuid(input.claimId);
  if (!claimId) throw new Error("Invalid claim id");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("A recovery reason is required");

  const rows = await sql`
    update company_directory_profiles profile
    set claim_reservation_id = null,
        claim_reservation_token = null,
        claim_reserved_at = null,
        updated_at = now()
    from company_directory_claims claim
    where claim.id = ${claimId}::uuid
      and claim.profile_id = profile.id
      and claim.status in ('pending', 'verified')
      and profile.claimed_workspace_id is null
      and profile.claim_reservation_id = claim.id
      and profile.claim_reserved_at < now() - (${CLAIM_RESERVATION_LEASE_MINUTES}::text || ' minutes')::interval
      and not exists (
        select 1
        from workspaces workspace
        where workspace.id = claim.requested_workspace_id
      )
    returning profile.id::text
  `;
  const profileId = String(rows[0]?.id ?? "");
  if (!profileId) {
    throw new Error("Reservation is still active, already resolved, or its workspace already exists");
  }

  await sql`
    insert into admin_audit_logs (admin_user_id, action, reason, previous_value, new_value)
    values (
      ${admin.userId}, 'company_directory.claim.reservation_released', ${reason},
      ${JSON.stringify({ claimId, profileId, reservation: "stale" })}::jsonb,
      ${JSON.stringify({ claimId, profileId, reservation: null })}::jsonb
    )
  `;

  return { claimId, profileId };
}

export async function approveAndProvisionCompanyDirectoryClaim(input: { claimId: string; reference: string }) {
  const admin = await requireSuperAdmin();
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const claimId = safeUuid(input.claimId);
  if (!claimId) throw new Error("Invalid claim id");
  const reference = input.reference.trim();
  if (reference.length < 3 || reference.length > 500) {
    throw new Error("Verification evidence/reference is required");
  }

  const rows = await sql`
    select
      claim.id::text,
      claim.status,
      claim.verification_method,
      claim.verification_reference,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.display_name,
      profile.city,
      profile.activity_description,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      profile.claim_reserved_at,
      u.id as claimant_user_id,
      u.email as claimant_email,
      u."emailVerified" as claimant_email_verified
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" u on u.id = claim.claimant_user_id
    where claim.id = ${claimId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Claim not found");
  if (!row.claimant_email_verified) throw new Error("Claimant email must be verified before approval");
  if (row.claimed_workspace_id) throw new Error("Company profile is already claimed");
  if (row.status !== "pending" && row.status !== "verified") throw new Error("Claim is not approvable");

  const emailEvidence = parseClaimEmailEvidence(row.verification_reference);
  if (String(row.verification_method) !== "email_domain" || !isClaimBusinessEmailVerified(emailEvidence)) {
    throw new Error("Business email must be verified before this claim can be approved");
  }
  if (!emailEvidence) throw new Error("Business email verification evidence is missing");

  const generatedWorkspaceId = randomUUID();
  const reservationToken = randomUUID();
  const claimantUserId = String(row.claimant_user_id);
  const claimantEmail = String(row.claimant_email).trim().toLowerCase();
  const companyName = String(row.display_name).trim();
  const city = String(row.city ?? "").trim();
  const profileId = String(row.profile_id);
  if (!companyName || !city || !claimantEmail) throw new Error("Claim lacks required provisioning data");

  const reserved = await sql`
    update company_directory_profiles profile
    set claim_reservation_id = ${claimId}::uuid,
        claim_reservation_token = ${reservationToken}::uuid,
        claim_reserved_at = now(),
        updated_at = now()
    where profile.id = ${profileId}::uuid
      and profile.claimed_workspace_id is null
      and (
        profile.claim_reservation_id is null
        or (
          profile.claim_reservation_id = ${claimId}::uuid
          and profile.claim_reserved_at < now() - (${CLAIM_RESERVATION_LEASE_MINUTES}::text || ' minutes')::interval
        )
      )
      and exists (
        select 1
        from company_directory_claims claim
        where claim.id = ${claimId}::uuid
          and claim.profile_id = profile.id
          and claim.status in ('pending', 'verified')
      )
    returning profile.id::text
  `;
  if (!reserved[0]) {
    throw new Error("Company profile is already reserved by an active claim operation");
  }

  const approvedEvidence = serializeClaimEmailEvidence({
    ...emailEvidence,
    adminReference: reference,
    adminReviewedAt: new Date().toISOString(),
  });

  const verified = await sql`
    update company_directory_claims
    set requested_workspace_id = coalesce(requested_workspace_id, ${generatedWorkspaceId}::uuid),
        status = 'verified',
        verification_method = 'email_domain',
        verification_reference = ${approvedEvidence},
        verified_at = coalesce(verified_at, now())
    where id = ${claimId}::uuid
      and profile_id = ${profileId}::uuid
      and status in ('pending', 'verified')
    returning id::text, requested_workspace_id::text
  `;
  const workspaceId = String(verified[0]?.requested_workspace_id ?? "");
  if (!workspaceId) {
    await sql`
      update company_directory_profiles
      set claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          updated_at = now()
      where id = ${profileId}::uuid
        and claim_reservation_id = ${claimId}::uuid
        and claim_reservation_token = ${reservationToken}::uuid
        and claimed_workspace_id is null
    `;
    throw new Error("Claim changed before provisioning could start");
  }

  const provisioned = await provisionWorkspace({
    workspaceId,
    userId: claimantUserId,
    slug: createWorkspaceSlug(companyName),
    companyName,
    city,
    email: claimantEmail,
    phone: emailEvidence.phone,
    planKey: "starter",
  });

  const finalized = await sql`
    with locked_pair as (
      select claim.id as claim_id, profile.id as profile_id
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      where claim.id = ${claimId}::uuid
        and claim.requested_workspace_id = ${workspaceId}::uuid
        and claim.status = 'verified'
        and profile.id = ${profileId}::uuid
        and profile.claimed_workspace_id is null
        and profile.claim_reservation_id = ${claimId}::uuid
        and profile.claim_reservation_token = ${reservationToken}::uuid
      for update of claim, profile
    ),
    claimed_profile as (
      update company_directory_profiles profile
      set claimed_workspace_id = ${workspaceId}::uuid,
          claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          publication_status = 'claimed',
          updated_at = now()
      from locked_pair pair
      where profile.id = pair.profile_id
      returning profile.id
    )
    update company_directory_claims claim
    set status = 'claimed', resolved_at = now()
    from locked_pair pair, claimed_profile profile
    where claim.id = pair.claim_id
      and profile.id = pair.profile_id
    returning claim.profile_id::text
  `;
  if (!finalized[0]) {
    throw new Error("Claim reservation was lost before finalization; wait for lease recovery and review the provisioned workspace");
  }

  const activityDescription = String(row.activity_description ?? "").trim();
  await sql.transaction((tx) => [
    tx`
      update workspace_experience_settings
      set business_intro = case
            when coalesce(business_intro, '') = '' then ${activityDescription}
            else business_intro
          end,
          updated_at = now()
      where workspace_id = ${workspaceId}::uuid
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId}, ${workspaceId}::uuid, 'company_directory.claim.approved', ${reference},
        ${JSON.stringify({ claimId, profileId, status: String(row.status), businessEmail: emailEvidence.businessEmail })}::jsonb,
        ${JSON.stringify({ claimId, profileId, status: "claimed", workspaceId })}::jsonb
      )
    `,
  ]);

  return { claimId, workspaceId: provisioned.workspaceId, trialEndsAt: provisioned.trialEndsAt };
}
