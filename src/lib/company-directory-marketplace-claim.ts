import "server-only";

import { randomUUID } from "node:crypto";

import { createWorkspaceSlug, provisionWorkspace } from "@/features/company/workspace-provisioning";
import {
  businessEmailDomainKind,
  isClaimBusinessEmailVerified,
  parseClaimEmailEvidence,
  validBusinessEmail,
} from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";

export type MarketplaceCompanyClaimProvisionResult =
  | { status: "provisioned"; workspaceId: string }
  | { status: "manual_review"; reason: string };

function normalizedEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

async function releaseOwnReservation(input: {
  profileId: string;
  claimId: string;
  reservationToken: string;
}) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      update company_directory_profiles
      set claim_reservation_id = null,
          claim_reservation_token = null,
          claim_reserved_at = null,
          updated_at = now()
      where id = ${input.profileId}::uuid
        and claim_reservation_id = ${input.claimId}::uuid
        and claim_reservation_token = ${input.reservationToken}::uuid
        and claimed_workspace_id is null
    `;
  } catch (error) {
    console.error("Failed to release Marketplace claim reservation", {
      claimId: input.claimId,
      profileId: input.profileId,
      error,
    });
  }
}

async function cleanupProvisionedMarketplaceWorkspace(input: {
  workspaceId: string;
  claimantUserId: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  try {
    const deleted = await sql`
      with cleanup_candidate as (
        select workspace.id
        from workspaces workspace
        where workspace.id = ${input.workspaceId}::uuid
          and workspace.status = 'trial'
          and exists (
            select 1
            from workspace_memberships membership
            where membership.workspace_id = workspace.id
              and membership.user_id = ${input.claimantUserId}
              and membership.role = 'owner'
          )
          and not exists (
            select 1
            from workspace_memberships membership
            where membership.workspace_id = workspace.id
              and membership.user_id <> ${input.claimantUserId}
          )
          and not exists (
            select 1
            from company_directory_profiles profile
            where profile.claimed_workspace_id = workspace.id
          )
          and not exists (
            select 1
            from company_directory_claims claim
            where claim.requested_workspace_id = workspace.id
              and claim.status = 'claimed'
          )
        for update of workspace
      ),
      deleted_booking_hours as (
        delete from workspace_booking_hours hours
        using cleanup_candidate candidate
        where hours.workspace_id = candidate.id::text
        returning hours.workspace_id
      ),
      deleted_reminder_settings as (
        delete from workspace_booking_reminder_settings settings
        using cleanup_candidate candidate
        where settings.workspace_id = candidate.id::text
        returning settings.workspace_id
      ),
      deleted_workspace_settings as (
        delete from workspace_settings settings
        using cleanup_candidate candidate
        where settings.workspace_id = candidate.id::text
        returning settings.workspace_id
      ),
      deleted_workspace as (
        delete from workspaces workspace
        using cleanup_candidate candidate
        where workspace.id = candidate.id
        returning workspace.id
      )
      select id::text
      from deleted_workspace
    `;
    if (deleted[0]?.id) return true;

    const remaining = await sql`
      select workspace.id::text
      from workspaces workspace
      where workspace.id = ${input.workspaceId}::uuid
      limit 1
    `;
    return !remaining[0]?.id;
  } catch (error) {
    console.error("Failed to compensate Marketplace claim workspace", {
      workspaceId: input.workspaceId,
      claimantUserId: input.claimantUserId,
      error,
    });
    return false;
  }
}

async function compensateFailedMarketplaceClaim(input: {
  workspaceId: string;
  claimantUserId: string;
  profileId: string;
  claimId: string;
  reservationToken: string;
}) {
  const cleaned = await cleanupProvisionedMarketplaceWorkspace({
    workspaceId: input.workspaceId,
    claimantUserId: input.claimantUserId,
  });
  if (!cleaned) {
    console.error("Marketplace claim compensation left reservation in place for manual recovery", {
      workspaceId: input.workspaceId,
      claimId: input.claimId,
      profileId: input.profileId,
    });
    return;
  }

  await releaseOwnReservation({
    profileId: input.profileId,
    claimId: input.claimId,
    reservationToken: input.reservationToken,
  });
}

/**
 * Auto-provisions only the narrow Marketplace invitation case where the same
 * conflict-free SCB business mailbox was recently invited, owns the signed-in
 * account, and has just been verified by the Company Directory claim challenge.
 * Opt-out controls future outreach; it does not revoke the right to verify
 * ownership of an existing public company profile. Every other claim stays on
 * the existing manual-review path.
 */
export async function tryAutoProvisionMarketplaceCompanyClaim(input: {
  claimId: string;
  claimantUserId: string;
}): Promise<MarketplaceCompanyClaimProvisionResult> {
  if (!isUuid(input.claimId) || !input.claimantUserId) {
    return { status: "manual_review", reason: "invalid_identity" };
  }

  const sql = getSql();
  if (!sql) return { status: "manual_review", reason: "database_unavailable" };

  const rows = await sql`
    select
      claim.id::text as claim_id,
      claim.status as claim_status,
      claim.verification_method,
      claim.verification_reference,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.display_name,
      profile.city,
      profile.activity_description,
      profile.publication_status,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.organization_kind,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      account.email as account_email,
      invitation.id::text as invitation_id,
      invitation.recipient_email as invitation_email
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" account on account.id = claim.claimant_user_id
    left join lateral (
      select invited.id, invited.recipient_email
      from marketplace_quote_invitations invited
      where invited.profile_id = claim.profile_id
        and lower(btrim(invited.recipient_email)) = lower(btrim(account.email))
        and invited.sent_at is not null
        and invited.sent_at >= now() - interval '7 days'
        and exists (
          select 1
          from company_directory_scb_enrichment scb
          where scb.profile_id = claim.profile_id
            and nullif(lower(btrim(scb.email)), '') = lower(btrim(invited.recipient_email))
            and jsonb_typeof(scb.conflicts) = 'array'
            and jsonb_array_length(scb.conflicts) = 0
        )
      order by invited.sent_at desc, invited.created_at desc, invited.id desc
      limit 1
    ) invitation on true
    where claim.id = ${input.claimId}::uuid
      and claim.claimant_user_id = ${input.claimantUserId}
      and claim.status in ('pending', 'verified')
      and claim.verification_method = 'email_domain'
    limit 1
  `;

  const row = rows[0];
  if (!row?.claim_id) return { status: "manual_review", reason: "claim_not_eligible" };

  const evidence = parseClaimEmailEvidence(row.verification_reference);
  const accountEmail = normalizedEmail(row.account_email);
  const businessEmail = normalizedEmail(evidence?.businessEmail);
  const invitationEmail = normalizedEmail(row.invitation_email);
  const requestedWorkspaceId = String(row.requested_workspace_id ?? "");

  if (!isClaimBusinessEmailVerified(evidence)) {
    return { status: "manual_review", reason: "business_email_not_verified" };
  }
  if (!validBusinessEmail(accountEmail) || businessEmailDomainKind(businessEmail) !== "business_domain") {
    return { status: "manual_review", reason: "business_domain_required" };
  }
  if (!row.invitation_id) return { status: "manual_review", reason: "marketplace_invitation_missing" };
  if (!businessEmail || accountEmail !== businessEmail || invitationEmail !== businessEmail) {
    return { status: "manual_review", reason: "marketplace_email_mismatch" };
  }
  if (requestedWorkspaceId && requestedWorkspaceId !== input.claimId) {
    return { status: "manual_review", reason: "existing_workspace_requested" };
  }
  if (
    String(row.publication_status) !== "published"
    || !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || !Boolean(row.auto_public_eligible)
    || String(row.organization_kind) !== "juridical_person"
    || Boolean(row.claimed_workspace_id)
  ) {
    return { status: "manual_review", reason: "profile_not_eligible" };
  }
  if (row.claim_reservation_id && String(row.claim_reservation_id) !== input.claimId) {
    return { status: "manual_review", reason: "profile_reserved" };
  }

  const profileId = String(row.profile_id);
  const companyName = String(row.display_name ?? "").trim();
  const city = String(row.city ?? "").trim();
  if (!isUuid(profileId) || !companyName || !city) {
    return { status: "manual_review", reason: "profile_details_missing" };
  }

  const reservationToken = randomUUID();
  const reserved = await sql`
    update company_directory_profiles profile
    set claim_reservation_id = ${input.claimId}::uuid,
        claim_reservation_token = ${reservationToken}::uuid,
        claim_reserved_at = now(),
        updated_at = now()
    where profile.id = ${profileId}::uuid
      and profile.claimed_workspace_id is null
      and (profile.claim_reservation_id is null or profile.claim_reservation_id = ${input.claimId}::uuid)
      and profile.publication_status = 'published'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.organization_kind = 'juridical_person'
      and exists (
        select 1
        from company_directory_claims current_claim
        where current_claim.id = ${input.claimId}::uuid
          and current_claim.profile_id = profile.id
          and current_claim.claimant_user_id = ${input.claimantUserId}
          and current_claim.status in ('pending', 'verified')
          and current_claim.verification_method = 'email_domain'
          and (
            current_claim.requested_workspace_id is null
            or current_claim.requested_workspace_id = ${input.claimId}::uuid
          )
      )
    returning profile.id::text
  `;
  if (!reserved[0]?.id) return { status: "manual_review", reason: "reservation_conflict" };

  try {
    await provisionWorkspace({
      workspaceId: input.claimId,
      userId: input.claimantUserId,
      slug: createWorkspaceSlug(companyName),
      companyName,
      city,
      email: businessEmail,
      phone: String(evidence?.phone ?? ""),
      planKey: "starter",
    });
  } catch (error) {
    await releaseOwnReservation({ profileId, claimId: input.claimId, reservationToken });
    console.error("Marketplace claim workspace provisioning failed", { claimId: input.claimId, error });
    return { status: "manual_review", reason: "workspace_provision_failed" };
  }

  const claimRows = await sql`
    update company_directory_claims claim
    set requested_workspace_id = ${input.claimId}::uuid,
        status = 'verified',
        verified_at = coalesce(claim.verified_at, now())
    where claim.id = ${input.claimId}::uuid
      and claim.profile_id = ${profileId}::uuid
      and claim.claimant_user_id = ${input.claimantUserId}
      and claim.status in ('pending', 'verified')
      and claim.verification_method = 'email_domain'
      and (claim.requested_workspace_id is null or claim.requested_workspace_id = ${input.claimId}::uuid)
    returning claim.id::text
  `;
  if (!claimRows[0]?.id) {
    await compensateFailedMarketplaceClaim({
      workspaceId: input.claimId,
      claimantUserId: input.claimantUserId,
      profileId,
      claimId: input.claimId,
      reservationToken,
    });
    return { status: "manual_review", reason: "claim_changed" };
  }

  const invitationId = String(row.invitation_id);
  const finalized = await sql`
    with eligible_invitation as (
      select invitation.id
      from marketplace_quote_invitations invitation
      where invitation.id = ${invitationId}::uuid
        and invitation.profile_id = ${profileId}::uuid
        and lower(btrim(invitation.recipient_email)) = ${businessEmail}
        and invitation.sent_at is not null
        and exists (
          select 1
          from company_directory_scb_enrichment scb
          where scb.profile_id = invitation.profile_id
            and nullif(lower(btrim(scb.email)), '') = lower(btrim(invitation.recipient_email))
            and jsonb_typeof(scb.conflicts) = 'array'
            and jsonb_array_length(scb.conflicts) = 0
        )
      for update of invitation
    ),
    locked_pair as (
      select claim.id as claim_id, profile.id as profile_id
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      join eligible_invitation invitation on true
      where claim.id = ${input.claimId}::uuid
        and claim.profile_id = ${profileId}::uuid
        and claim.claimant_user_id = ${input.claimantUserId}
        and claim.requested_workspace_id = ${input.claimId}::uuid
        and claim.status = 'verified'
        and claim.verification_method = 'email_domain'
        and profile.claimed_workspace_id is null
        and profile.claim_reservation_id = ${input.claimId}::uuid
        and profile.claim_reservation_token = ${reservationToken}::uuid
      for update of claim, profile
    ),
    claimed_profile as (
      update company_directory_profiles profile
      set claimed_workspace_id = ${input.claimId}::uuid,
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
          resolved_at = now()
      from locked_pair pair, claimed_profile profile
      where claim.id = pair.claim_id
        and profile.id = pair.profile_id
      returning claim.id
    ),
    linked_invitation as (
      update marketplace_quote_invitations invitation
      set workspace_id = ${input.claimId}::uuid,
          updated_at = now()
      from claimed_claim, eligible_invitation eligible
      where invitation.id = eligible.id
        and invitation.profile_id = ${profileId}::uuid
      returning invitation.id
    ),
    linked_offer as (
      update marketplace_quote_offers offer
      set workspace_id = ${input.claimId}::uuid,
          updated_at = now()
      from linked_invitation invitation
      where offer.invitation_id = invitation.id
        and offer.profile_id = ${profileId}::uuid
      returning offer.id
    ),
    experience_settings as (
      insert into workspace_experience_settings (workspace_id, business_intro)
      select ${input.claimId}::uuid, ${String(row.activity_description ?? "").trim()}
      from claimed_claim
      on conflict (workspace_id) do update set
        business_intro = case
          when coalesce(workspace_experience_settings.business_intro, '') = '' then excluded.business_intro
          else workspace_experience_settings.business_intro
        end,
        updated_at = now()
      returning workspace_id
    )
    select claim.id::text
    from claimed_claim claim
    join experience_settings settings on true
  `;

  if (!finalized[0]?.id) {
    await compensateFailedMarketplaceClaim({
      workspaceId: input.claimId,
      claimantUserId: input.claimantUserId,
      profileId,
      claimId: input.claimId,
      reservationToken,
    });
    return { status: "manual_review", reason: "finalize_conflict" };
  }

  return { status: "provisioned", workspaceId: input.claimId };
}
