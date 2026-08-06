import type { getSql } from "@/lib/db/server";

export const WEBSITE_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export type WebsiteReviewStatus = (typeof WEBSITE_REVIEW_STATUSES)[number];
export type WebsiteReviewModerationStatus = Extract<WebsiteReviewStatus, "approved" | "rejected">;
export type WebsiteReviewModerationSql = NonNullable<ReturnType<typeof getSql>>;

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
