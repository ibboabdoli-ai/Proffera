import type { getSql } from "@/lib/db/server";
import type { VerifiedReviewSubmission } from "@/features/reviews/verified-review";

export type VerifiedReviewSql = NonNullable<ReturnType<typeof getSql>>;

export async function persistReviewInvitation(input: {
  sql: VerifiedReviewSql;
  actorUserId: string;
  workspaceId: string;
  bookingId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  const { sql, actorUserId, workspaceId, bookingId, tokenHash, expiresAt } = input;

  return sql`
    with target as (
      select
        b.id as booking_id,
        b.customer_id,
        b.title,
        c.name as customer_name,
        c.email as customer_email
      from bookings b
      join workspaces w
        on w.id::text = b.workspace_id
       and w.id = ${workspaceId}::uuid
       and w.status in ('active', 'trial')
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.id = ${bookingId}::uuid
        and b.workspace_id = ${workspaceId}
        and b.status = 'completed'
        and exists (
          select 1
          from workspace_feature_flags feature
          where feature.workspace_id = w.id
            and feature.feature_key = 'verified_reviews'
            and feature.enabled = true
        )
      limit 1
    ),
    existing as (
      select invitation.status
      from website_review_invitations invitation
      join target on target.booking_id = invitation.booking_id
      where invitation.workspace_id = ${workspaceId}::uuid
      limit 1
    ),
    issued as (
      insert into website_review_invitations (
        workspace_id,
        booking_id,
        customer_id,
        token_hash,
        status,
        expires_at,
        used_at,
        revoked_at,
        created_by_user_id,
        updated_at
      )
      select
        ${workspaceId}::uuid,
        target.booking_id,
        target.customer_id,
        ${tokenHash},
        'pending',
        ${expiresAt}::timestamptz,
        null,
        null,
        ${actorUserId},
        now()
      from target
      on conflict (workspace_id, booking_id) do update
      set
        customer_id = excluded.customer_id,
        token_hash = excluded.token_hash,
        status = 'pending',
        expires_at = excluded.expires_at,
        used_at = null,
        revoked_at = null,
        created_by_user_id = excluded.created_by_user_id,
        updated_at = now()
      where website_review_invitations.status <> 'used'
      returning id, booking_id, customer_id, expires_at
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      )
      select
        ${actorUserId},
        ${workspaceId}::uuid,
        'website_review.invitation_issued',
        'Verified review invitation issued from workspace dashboard',
        jsonb_build_object(
          'booking_id', issued.booking_id,
          'status', coalesce((select status from existing limit 1), 'none')
        ),
        jsonb_build_object(
          'booking_id', issued.booking_id,
          'status', 'pending',
          'expires_at', issued.expires_at
        )
      from issued
      returning id
    )
    select
      exists(select 1 from target) as target_exists,
      (select status from existing limit 1) as existing_status,
      (select id from issued limit 1) as invitation_id,
      (select expires_at from issued limit 1) as expires_at,
      (select booking_id from target limit 1) as booking_id,
      (select title from target limit 1) as booking_title,
      (select customer_name from target limit 1) as customer_name,
      (select customer_email from target limit 1) as customer_email,
      exists(select 1 from audited) as audited
  `;
}

export async function persistVerifiedReviewSubmission(input: {
  sql: VerifiedReviewSql;
  tokenHash: string;
  review: VerifiedReviewSubmission;
}) {
  const { sql, tokenHash, review } = input;

  return sql`
    with locked as (
      select
        invitation.id as invitation_id,
        invitation.workspace_id,
        invitation.booking_id,
        invitation.customer_id,
        invitation.status as invitation_status,
        invitation.expires_at,
        workspace.status as workspace_status,
        booking.status as booking_status,
        booking.workspace_id as booking_workspace_id,
        booking.customer_id as booking_customer_id,
        coalesce(nullif(booking.service, ''), booking.title) as service,
        nullif(coalesce(booking.city, customer.city, ''), '') as area,
        exists (
          select 1
          from workspace_feature_flags feature
          where feature.workspace_id = invitation.workspace_id
            and feature.feature_key = 'verified_reviews'
            and feature.enabled = true
        ) as feature_enabled
      from website_review_invitations invitation
      join workspaces workspace on workspace.id = invitation.workspace_id
      join bookings booking on booking.id = invitation.booking_id
      left join customers customer
        on customer.id = invitation.customer_id
       and customer.workspace_id = booking.workspace_id
      where invitation.token_hash = ${tokenHash}
      for update of invitation
    ),
    eligible as (
      select *
      from locked
      where invitation_status = 'pending'
        and expires_at > now()
        and workspace_status in ('active', 'trial')
        and feature_enabled = true
        and booking_status = 'completed'
        and workspace_id::text = booking_workspace_id
        and (
          customer_id is null
          or customer_id = booking_customer_id
        )
        and not exists (
          select 1
          from website_reviews existing_review
          where existing_review.review_invitation_id = invitation_id
             or (existing_review.booking_id = locked.booking_id and existing_review.is_verified = true)
        )
    ),
    created as (
      insert into website_reviews (
        workspace_id,
        reviewer_name,
        rating,
        service,
        area,
        message,
        status,
        review_invitation_id,
        booking_id,
        customer_id,
        is_verified,
        verified_at
      )
      select
        eligible.workspace_id,
        ${review.reviewerName},
        ${review.rating},
        eligible.service,
        eligible.area,
        ${review.message},
        'pending',
        eligible.invitation_id,
        eligible.booking_id,
        eligible.customer_id,
        true,
        now()
      from eligible
      on conflict do nothing
      returning id, review_invitation_id
    ),
    consumed as (
      update website_review_invitations invitation
      set
        status = 'used',
        used_at = now(),
        updated_at = now()
      from created
      where invitation.id = created.review_invitation_id
      returning invitation.id
    )
    select
      (select id from created limit 1) as review_id,
      exists(select 1 from consumed) as submitted,
      (select invitation_status from locked limit 1) as invitation_status,
      (select expires_at from locked limit 1) as expires_at,
      (select booking_status from locked limit 1) as booking_status,
      (select workspace_status from locked limit 1) as workspace_status,
      (select feature_enabled from locked limit 1) as feature_enabled,
      exists(
        select 1
        from website_reviews review
        join locked on true
        where review.review_invitation_id = locked.invitation_id
           or (review.booking_id = locked.booking_id and review.is_verified = true)
      ) as review_exists
  `;
}
