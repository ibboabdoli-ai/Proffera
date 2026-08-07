import { z } from "zod";

import type { getSql } from "@/lib/db/server";

export const WEBSITE_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export type WebsiteReviewStatus = (typeof WEBSITE_REVIEW_STATUSES)[number];
export type WebsiteReviewModerationStatus = Extract<WebsiteReviewStatus, "approved" | "rejected">;
export type WebsiteReviewModerationSql = NonNullable<ReturnType<typeof getSql>>;

const optionalReviewTextSchema = z
  .string()
  .trim()
  .max(120)
  .transform((value) => value || null);

export const websiteReviewEditSchema = z.object({
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  service: optionalReviewTextSchema,
  area: optionalReviewTextSchema,
  message: z.string().trim().min(10).max(1_000),
});

export const websiteReviewPresentationSchema = z.object({
  ownerReply: z
    .string()
    .trim()
    .max(1_000)
    .transform((value) => value || null),
  isFeatured: z.boolean(),
});

export type WebsiteReviewEdit = z.infer<typeof websiteReviewEditSchema>;
export type WebsiteReviewPresentation = z.infer<typeof websiteReviewPresentationSchema>;

export function isWebsiteReviewStatus(value: unknown): value is WebsiteReviewStatus {
  return typeof value === "string" && WEBSITE_REVIEW_STATUSES.includes(value as WebsiteReviewStatus);
}

export async function persistWebsiteReviewModeration(input: {
  sql: WebsiteReviewModerationSql;
  actorUserId: string;
  workspaceId: string;
  reviewId: string;
  nextStatus: WebsiteReviewModerationStatus;
}) {
  const { sql, actorUserId, workspaceId, reviewId, nextStatus } = input;

  return sql`
    with previous as (
      select id, workspace_id, status
      from website_reviews
      where id = ${reviewId}::uuid
        and workspace_id = ${workspaceId}::uuid
      for update
    ),
    updated as (
      update website_reviews r
      set
        status = ${nextStatus},
        moderated_at = now(),
        moderated_by_user_id = ${actorUserId},
        published_at = case when ${nextStatus} = 'approved' then coalesce(r.published_at, now()) else null end,
        is_featured = case when ${nextStatus} = 'approved' then r.is_featured else false end,
        updated_at = now()
      from previous p
      where r.id = p.id
        and p.status <> ${nextStatus}
      returning
        r.id,
        r.workspace_id,
        p.status as previous_status,
        r.status as next_status
    )
    insert into admin_audit_logs (
      admin_user_id, workspace_id, action, reason, previous_value, new_value
    )
    select
      ${actorUserId},
      updated.workspace_id,
      'website_review.status_updated',
      'Website review moderation changed from workspace dashboard',
      jsonb_build_object(
        'review_id', updated.id,
        'status', updated.previous_status
      ),
      jsonb_build_object(
        'review_id', updated.id,
        'status', updated.next_status
      )
    from updated
    returning id
  `;
}

export async function persistWebsiteReviewEdit(input: {
  sql: WebsiteReviewModerationSql;
  actorUserId: string;
  workspaceId: string;
  reviewId: string;
  review: WebsiteReviewEdit;
}) {
  const { sql, actorUserId, workspaceId, reviewId, review } = input;

  return sql`
    with previous as (
      select id, workspace_id, reviewer_name, rating, service, area, message
      from website_reviews
      where id = ${reviewId}::uuid
        and workspace_id = ${workspaceId}::uuid
      for update
    ),
    changed as (
      select
        previous.*,
        array_remove(array[
          case when previous.reviewer_name is distinct from ${review.reviewerName} then 'reviewer_name' end,
          case when previous.rating is distinct from ${review.rating} then 'rating' end,
          case when previous.service is distinct from ${review.service} then 'service' end,
          case when previous.area is distinct from ${review.area} then 'area' end,
          case when previous.message is distinct from ${review.message} then 'message' end
        ], null)::text[] as changed_fields
      from previous
      where (previous.reviewer_name, previous.rating, previous.service, previous.area, previous.message)
        is distinct from (${review.reviewerName}, ${review.rating}, ${review.service}, ${review.area}, ${review.message})
    ),
    updated as (
      update website_reviews review_row
      set
        reviewer_name = ${review.reviewerName},
        rating = ${review.rating},
        service = ${review.service},
        area = ${review.area},
        message = ${review.message},
        updated_at = now()
      from changed
      where review_row.id = changed.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${actorUserId},
        updated.workspace_id,
        'website_review.content_updated',
        'Website review content edited from workspace dashboard',
        jsonb_build_object('review_id', updated.id),
        jsonb_build_object(
          'review_id', updated.id,
          'changed_fields', to_jsonb(changed.changed_fields)
        )
      from updated
      join changed on changed.id = updated.id
      returning id
    )
    select previous.id
    from previous
    where not exists (select 1 from changed)
    union all
    select updated.id
    from updated
    where exists (select 1 from audited)
    limit 1
  `;
}

export async function persistWebsiteReviewPresentation(input: {
  sql: WebsiteReviewModerationSql;
  actorUserId: string;
  workspaceId: string;
  reviewId: string;
  presentation: WebsiteReviewPresentation;
}) {
  const { sql, actorUserId, workspaceId, reviewId, presentation } = input;

  return sql`
    with previous as (
      select
        id,
        workspace_id,
        owner_reply,
        owner_replied_at,
        is_featured,
        status,
        is_verified
      from website_reviews
      where id = ${reviewId}::uuid
        and workspace_id = ${workspaceId}::uuid
      for update
    ),
    eligible as (
      select *
      from previous
      where status = 'approved'
        and is_verified = true
    ),
    changed as (
      select
        eligible.*,
        array_remove(array[
          case when eligible.owner_reply is distinct from ${presentation.ownerReply} then 'owner_reply' end,
          case when eligible.is_featured is distinct from ${presentation.isFeatured} then 'is_featured' end
        ], null)::text[] as changed_fields
      from eligible
      where (eligible.owner_reply, eligible.is_featured)
        is distinct from (${presentation.ownerReply}, ${presentation.isFeatured})
    ),
    updated as (
      update website_reviews review_row
      set
        owner_reply = ${presentation.ownerReply},
        owner_replied_at = case
          when changed.owner_reply is distinct from ${presentation.ownerReply}
            then case when ${presentation.ownerReply}::text is null then null else now() end
          else changed.owner_replied_at
        end,
        is_featured = ${presentation.isFeatured},
        updated_at = now()
      from changed
      where review_row.id = changed.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${actorUserId},
        updated.workspace_id,
        'website_review.presentation_updated',
        'Website review owner reply or featured state changed from workspace dashboard',
        jsonb_build_object(
          'review_id', updated.id,
          'owner_reply_present', changed.owner_reply is not null,
          'is_featured', changed.is_featured
        ),
        jsonb_build_object(
          'review_id', updated.id,
          'owner_reply_present', ${presentation.ownerReply}::text is not null,
          'is_featured', ${presentation.isFeatured},
          'changed_fields', to_jsonb(changed.changed_fields)
        )
      from updated
      join changed on changed.id = updated.id
      returning id
    )
    select eligible.id
    from eligible
    where not exists (select 1 from changed)
    union all
    select updated.id
    from updated
    where exists (select 1 from audited)
    limit 1
  `;
}

export async function persistWebsiteReviewDeletion(input: {
  sql: WebsiteReviewModerationSql;
  actorUserId: string;
  workspaceId: string;
  reviewId: string;
}) {
  const { sql, actorUserId, workspaceId, reviewId } = input;

  return sql`
    with previous as (
      select id, workspace_id, status, is_verified
      from website_reviews
      where id = ${reviewId}::uuid
        and workspace_id = ${workspaceId}::uuid
      for update
    ),
    deleted as (
      delete from website_reviews review_row
      using previous
      where review_row.id = previous.id
      returning review_row.id, review_row.workspace_id
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${actorUserId},
        deleted.workspace_id,
        'website_review.deleted',
        'Website review permanently deleted from workspace dashboard',
        jsonb_build_object(
          'review_id', deleted.id,
          'status', previous.status,
          'is_verified', previous.is_verified
        ),
        jsonb_build_object(
          'review_id', deleted.id,
          'deleted', true
        )
      from deleted
      join previous on previous.id = deleted.id
      returning id
    )
    select deleted.id
    from deleted
    where exists (select 1 from audited)
  `;
}
