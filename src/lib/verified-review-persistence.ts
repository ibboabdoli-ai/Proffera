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
  const {
    sql,
    actorUserId,
    workspaceId,
    bookingId,
    tokenHash,
    expiresAt,
  } = input;

  return sql`
    with target as (
      select
        b.id as booking_id,
        b.customer_id,
        b.title,
        c.name as customer_name,
        c.email as customer_email
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.id = ${bookingId}::uuid
        and b.workspace_id = ${workspaceId}
        and b.status = 'completed'
      limit 1
    ),
    existing as (
      select i.status
      from website_review_invitations i
      join target t on t.booking_id = i.booking_id
      where i.workspace_id = ${workspaceId}::uuid
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
        t.booking_id,
        t.customer_id,
        ${tokenHash},
        'pending',
        ${expiresAt}::timestamptz,
        null,
        null,
        ${actorUserId},
        now()
      from target t
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
        i.id as invitation_id,
        i.workspace_id,
        i.booking_id,
        i.customer_id,
        i.status as invitation_status,
        i.expires_at,
        b.status as booking_status,
        b.workspace_id as booking_workspace_id,
        b.customer_id as booking_customer_id,
        coalesce(nullif(b.service, ''), b.title) as service,
        nullif(coalesce(b.city, c.city, ''), '') as area
      from website_review_invitations i
      join bookings b on b.id = i.booking_id
      left join customers c
        on c.id = i.customer_id
       and c.workspace_id = b.workspace_id
      where i.token_hash = ${tokenHash}
      for update of i
    ),
    eligible as (
      select *
      from locked
      where invitation_status = 'pending'
        and expires_at > now()
        and booking_status = 'completed'
        and workspace_id::text = booking_workspace_id
        and (
          customer_id is null
          or customer_id = booking_customer_id
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
        e.workspace_id,
        ${review.reviewerName},
        ${review.rating},
        e.service,
        e.area,
        ${review.message},
        'pending',
        e.invitation_id,
        e.booking_id,
        e.customer_id,
        true,
        now()
      from eligible e
      on conflict do nothing
      returning id, review_invitation_id
    ),
    consumed as (
      update website_review_invitations i
      set
        status = 'used',
        used_at = now(),
        updated_at = now()
      from created c
      where i.id = c.review_invitation_id
      returning i.id
    )
    select
      (select id from created limit 1) as review_id,
      exists(select 1 from consumed) as submitted,
      (select invitation_status from locked limit 1) as invitation_status,
      (select expires_at from locked limit 1) as expires_at,
      (select booking_status from locked limit 1) as booking_status,
      exists(
        select 1
        from website_reviews r
        join locked l on true
        where r.review_invitation_id = l.invitation_id
           or (r.booking_id = l.booking_id and r.is_verified = true)
      ) as review_exists
  `;
}
