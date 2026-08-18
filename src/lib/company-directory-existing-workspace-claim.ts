import "server-only";

import { getSql } from "@/lib/db/server";

export async function finalizeCompanyDirectoryClaimIntoExistingWorkspace(input: {
  claimId: string;
  profileId: string;
  workspaceId: string;
  claimantUserId: string;
  adminUserId: string;
  adminReference: string;
  approvedEvidence: string;
  activityDescription: string;
}) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    with eligible_target as (
      select workspace.id
      from workspaces workspace
      join workspace_memberships membership
        on membership.workspace_id = workspace.id
       and membership.user_id = ${input.claimantUserId}
       and membership.role in ('owner', 'admin')
      where workspace.id = ${input.workspaceId}::uuid
        and workspace.status in ('active', 'trial')
        and not exists (
          select 1
          from company_directory_profiles other_profile
          where other_profile.claimed_workspace_id = workspace.id
            and other_profile.id <> ${input.profileId}::uuid
        )
      limit 1
    ),
    locked_pair as (
      select claim.id as claim_id, profile.id as profile_id
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      join eligible_target target on target.id = claim.requested_workspace_id
      where claim.id = ${input.claimId}::uuid
        and claim.profile_id = ${input.profileId}::uuid
        and claim.requested_workspace_id = ${input.workspaceId}::uuid
        and claim.claimant_user_id = ${input.claimantUserId}
        and claim.status in ('pending', 'verified')
        and profile.claimed_workspace_id is null
        and profile.claim_reservation_id is null
        and profile.publication_status = 'published'
        and profile.is_active = true
        and profile.privacy_blocked = false
        and profile.auto_public_eligible = true
      for update of claim, profile
    ),
    claimed_profile as (
      update company_directory_profiles profile
      set claimed_workspace_id = ${input.workspaceId}::uuid,
          claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          publication_status = 'claimed',
          updated_at = now()
      from locked_pair pair
      where profile.id = pair.profile_id
      returning profile.id
    ),
    claimed_claim as (
      update company_directory_claims claim
      set status = 'claimed',
          verification_method = 'email_domain',
          verification_reference = ${input.approvedEvidence},
          verified_at = coalesce(claim.verified_at, now()),
          resolved_at = now()
      from locked_pair pair, claimed_profile profile
      where claim.id = pair.claim_id
        and profile.id = pair.profile_id
      returning claim.id
    ),
    experience_settings as (
      insert into workspace_experience_settings (workspace_id, business_intro)
      select ${input.workspaceId}::uuid, ${input.activityDescription}
      from claimed_claim
      on conflict (workspace_id) do update set
        business_intro = case
          when coalesce(workspace_experience_settings.business_intro, '') = '' then excluded.business_intro
          else workspace_experience_settings.business_intro
        end,
        updated_at = now()
      returning workspace_id
    ),
    audit_log as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${input.adminUserId},
        ${input.workspaceId}::uuid,
        'company_directory.claim.approved_existing_workspace',
        ${input.adminReference},
        ${JSON.stringify({ claimId: input.claimId, profileId: input.profileId, target: "existing_workspace" })}::jsonb,
        ${JSON.stringify({ claimId: input.claimId, profileId: input.profileId, status: "claimed", workspaceId: input.workspaceId })}::jsonb
      from claimed_claim
      returning id
    )
    select claim.id::text
    from claimed_claim claim
    join experience_settings settings on true
    join audit_log audit on true
  `;

  if (!rows[0]?.id) {
    throw new Error("Existing workspace is not an eligible claim target or the claim changed before approval");
  }

  return { claimId: input.claimId, workspaceId: input.workspaceId, trialEndsAt: null };
}
