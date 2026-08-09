import "server-only";

import { randomUUID } from "node:crypto";

import { createWorkspaceSlug, provisionWorkspace } from "@/features/company/workspace-provisioning";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

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
    update company_directory_claims
    set status = 'rejected', resolved_at = now(), verification_reference = ${reason}
    where id = ${claimId}::uuid and status in ('pending', 'verified')
    returning profile_id::text
  `;
  const profileId = String(rows[0]?.profile_id ?? "");
  if (!profileId) throw new Error("Claim is no longer pending");

  await sql`
    insert into admin_audit_logs (admin_user_id, action, reason, previous_value, new_value)
    values (
      ${admin.userId}, 'company_directory.claim.rejected', ${reason},
      ${JSON.stringify({ claimId, profileId, status: "pending" })}::jsonb,
      ${JSON.stringify({ claimId, profileId, status: "rejected" })}::jsonb
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
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.display_name,
      profile.city,
      profile.activity_description,
      profile.claimed_workspace_id::text,
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

  const workspaceId = String(row.requested_workspace_id ?? "") || randomUUID();
  const claimantUserId = String(row.claimant_user_id);
  const claimantEmail = String(row.claimant_email).trim().toLowerCase();
  const companyName = String(row.display_name).trim();
  const city = String(row.city ?? "").trim();
  if (!companyName || !city || !claimantEmail) throw new Error("Claim lacks required provisioning data");

  await sql`
    update company_directory_claims
    set requested_workspace_id = ${workspaceId}::uuid,
        status = 'verified',
        verification_method = 'manual_review',
        verification_reference = ${reference},
        verified_at = coalesce(verified_at, now())
    where id = ${claimId}::uuid
      and status in ('pending', 'verified')
  `;

  const provisioned = await provisionWorkspace({
    workspaceId,
    userId: claimantUserId,
    slug: createWorkspaceSlug(companyName),
    companyName,
    city,
    email: claimantEmail,
    phone: "",
    planKey: "starter",
  });

  const activityDescription = String(row.activity_description ?? "").trim();
  await sql.transaction((tx) => [
    tx`
      update company_directory_profiles
      set claimed_workspace_id = ${workspaceId}::uuid,
          publication_status = 'claimed',
          updated_at = now()
      where id = ${String(row.profile_id)}::uuid
        and claimed_workspace_id is null
    `,
    tx`
      update company_directory_claims
      set status = 'claimed', resolved_at = now()
      where id = ${claimId}::uuid
        and requested_workspace_id = ${workspaceId}::uuid
        and status = 'verified'
    `,
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
        ${JSON.stringify({ claimId, profileId: String(row.profile_id), status: String(row.status) })}::jsonb,
        ${JSON.stringify({ claimId, profileId: String(row.profile_id), status: "claimed", workspaceId })}::jsonb
      )
    `,
  ]);

  return { claimId, workspaceId: provisioned.workspaceId, trialEndsAt: provisioned.trialEndsAt };
}
