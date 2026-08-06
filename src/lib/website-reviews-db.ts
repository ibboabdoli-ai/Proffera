import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const reviewStatuses = ["pending", "approved", "rejected"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WebsiteReviewStatus = (typeof reviewStatuses)[number];

export type PublishedWebsiteReview = {
  id: string;
  reviewerName: string;
  rating: number;
  service: string | null;
  area: string | null;
  message: string;
  publishedAt: string;
};

export type DashboardWebsiteReview = PublishedWebsiteReview & {
  status: WebsiteReviewStatus;
  createdAt: string;
};

export type SubmitWebsiteReviewInput = {
  workspaceSlug: string;
  reviewerName: string;
  rating: number;
  service: string | null;
  area: string | null;
  message: string;
};

function toText(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function toRating(value: unknown) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function isReviewStatus(value: unknown): value is WebsiteReviewStatus {
  return typeof value === "string" && reviewStatuses.includes(value as WebsiteReviewStatus);
}

function toPublishedReview(row: Record<string, unknown>): PublishedWebsiteReview | null {
  const id = toText(row.id);
  const reviewerName = toText(row.reviewer_name);
  const rating = toRating(row.rating);
  const message = toText(row.message);
  const publishedAt = toText(row.published_at);

  if (!id || !reviewerName || !rating || !message || !publishedAt) {
    return null;
  }

  return {
    id,
    reviewerName,
    rating,
    service: row.service ? toText(row.service) : null,
    area: row.area ? toText(row.area) : null,
    message,
    publishedAt,
  };
}

export async function getPublishedWebsiteReviews(workspaceSlug: string): Promise<PublishedWebsiteReview[]> {
  const sql = getSql();
  if (!sql || !workspaceSlug) return [];

  try {
    const rows = await sql`
      select r.id, r.reviewer_name, r.rating, r.service, r.area, r.message, r.published_at
      from website_reviews r
      join workspaces w on w.id = r.workspace_id
      where w.slug = ${workspaceSlug}
        and w.status in ('active', 'trial')
        and r.status = 'approved'
      order by r.published_at desc nulls last, r.created_at desc
      limit 6
    `;

    return rows.flatMap((row) => {
      const review = toPublishedReview(row);
      return review ? [review] : [];
    });
  } catch (error) {
    console.error("Failed to read published website reviews", error);
    return [];
  }
}

export async function submitWebsiteReview(input: SubmitWebsiteReviewInput) {
  const sql = getSql();
  if (!sql || !input.workspaceSlug) return false;

  try {
    const workspaceRows = await sql`
      select id
      from workspaces
      where slug = ${input.workspaceSlug}
        and status in ('active', 'trial')
      limit 1
    `;
    const workspaceId = toText(workspaceRows[0]?.id);

    if (!workspaceId) return false;

    const rows = await sql`
      insert into website_reviews (
        workspace_id, reviewer_name, rating, service, area, message, status
      ) values (
        ${workspaceId}::uuid, ${input.reviewerName}, ${input.rating}, ${input.service},
        ${input.area}, ${input.message}, 'pending'
      )
      returning id
    `;

    return Boolean(rows[0]?.id);
  } catch (error) {
    console.error("Failed to save website review", error);
    return false;
  }
}

export async function getDashboardWebsiteReviews(): Promise<DashboardWebsiteReview[]> {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return [];

  try {
    const rows = await sql`
      select id, reviewer_name, rating, service, area, message, status, created_at, published_at
      from website_reviews
      where workspace_id = ${access.workspaceId}::uuid
      order by
        case status when 'pending' then 0 when 'approved' then 1 else 2 end,
        created_at desc
      limit 100
    `;

    return rows.flatMap((row) => {
      const published = toPublishedReview({ ...row, published_at: row.published_at ?? row.created_at });
      const status = row.status;

      if (!published || !isReviewStatus(status)) return [];

      return [{ ...published, status, createdAt: toText(row.created_at) }];
    });
  } catch (error) {
    console.error("Failed to read dashboard website reviews", error);
    return [];
  }
}

export async function updateDashboardWebsiteReviewStatus(id: string, status: Extract<WebsiteReviewStatus, "approved" | "rejected">) {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);

  if (!access.ok || !canManageWorkspaceSettings(access) || !sql || !uuidPattern.test(id) || !isReviewStatus(status)) {
    return false;
  }

  try {
    const rows = await sql`
      with previous as (
        select id, workspace_id, status, moderated_at, moderated_by_user_id, published_at
        from website_reviews
        where id = ${id}::uuid
          and workspace_id = ${access.workspaceId}::uuid
          and status <> ${status}
        for update
      ),
      updated as (
        update website_reviews review
        set
          status = ${status},
          moderated_at = now(),
          moderated_by_user_id = ${access.userId},
          published_at = case when ${status} = 'approved' then coalesce(review.published_at, now()) else null end
        from previous
        where review.id = previous.id
        returning review.id, review.workspace_id, review.status, review.moderated_at,
          review.moderated_by_user_id, review.published_at
      ),
      audit as (
        insert into admin_audit_logs (
          admin_user_id, workspace_id, action, reason, previous_value, new_value
        )
        select
          ${access.userId}, previous.workspace_id, 'website_review.status_updated',
          ${`Website review status changed to ${status}`},
          jsonb_build_object(
            'review_id', previous.id,
            'status', previous.status,
            'moderated_at', previous.moderated_at,
            'moderated_by_user_id', previous.moderated_by_user_id,
            'published_at', previous.published_at
          ),
          jsonb_build_object(
            'review_id', updated.id,
            'status', updated.status,
            'moderated_at', updated.moderated_at,
            'moderated_by_user_id', updated.moderated_by_user_id,
            'published_at', updated.published_at
          )
        from previous
        join updated on updated.id = previous.id
        returning id
      )
      select updated.id, audit.id as audit_id
      from updated
      join audit on true
    `;

    return Boolean(rows[0]?.id && rows[0]?.audit_id);
  } catch (error) {
    console.error("Failed to moderate website review", error);
    return false;
  }
}
