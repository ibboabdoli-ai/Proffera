import "server-only";

import { getSql } from "@/lib/db/server";
import {
  isWebsiteReviewStatus,
  persistWebsiteReviewEdit,
  persistWebsiteReviewModeration,
  websiteReviewEditSchema,
  type WebsiteReviewModerationStatus,
} from "@/lib/website-review-moderation";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WebsiteReviewStatus =
  import("@/lib/website-review-moderation").WebsiteReviewStatus;

export type PublishedWebsiteReview = {
  id: string;
  reviewerName: string;
  rating: number;
  service: string | null;
  area: string | null;
  message: string;
  publishedAt: string;
  isVerified: boolean;
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

function toBoolean(value: unknown) {
  return value === true || value === "true";
}

function toPublishedReview(row: Record<string, unknown>): PublishedWebsiteReview | null {
  const id = toText(row.id);
  const reviewerName = toText(row.reviewer_name);
  const rating = toRating(row.rating);
  const message = toText(row.message);
  const publishedAt = toText(row.published_at);

  if (!id || !reviewerName || !rating || !message || !publishedAt) return null;

  return {
    id,
    reviewerName,
    rating,
    service: row.service ? toText(row.service) : null,
    area: row.area ? toText(row.area) : null,
    message,
    publishedAt,
    isVerified: toBoolean(row.is_verified),
  };
}

export async function getPublishedWebsiteReviews(
  workspaceSlug: string,
): Promise<PublishedWebsiteReview[]> {
  const sql = getSql();
  if (!sql || !workspaceSlug) return [];

  try {
    const rows = await sql`
      select
        review.id,
        review.reviewer_name,
        review.rating,
        review.service,
        review.area,
        review.message,
        review.published_at,
        review.is_verified
      from website_reviews review
      join workspaces workspace on workspace.id = review.workspace_id
      where workspace.slug = ${workspaceSlug}
        and workspace.status in ('active', 'trial')
        and review.status = 'approved'
        and review.is_verified = true
      order by review.published_at desc nulls last, review.created_at desc
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
        workspace_id,
        reviewer_name,
        rating,
        service,
        area,
        message,
        status,
        is_verified
      ) values (
        ${workspaceId}::uuid,
        ${input.reviewerName},
        ${input.rating},
        ${input.service},
        ${input.area},
        ${input.message},
        'pending',
        false
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
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getSql()),
  ]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return [];

  try {
    const rows = await sql`
      select
        id,
        reviewer_name,
        rating,
        service,
        area,
        message,
        status,
        created_at,
        published_at,
        is_verified
      from website_reviews
      where workspace_id = ${access.workspaceId}::uuid
      order by
        case status when 'pending' then 0 when 'approved' then 1 else 2 end,
        created_at desc
      limit 100
    `;

    return rows.flatMap((row) => {
      const published = toPublishedReview({
        ...row,
        published_at: row.published_at ?? row.created_at,
      });
      const status = row.status;
      if (!published || !isWebsiteReviewStatus(status)) return [];
      return [{ ...published, status, createdAt: toText(row.created_at) }];
    });
  } catch (error) {
    console.error("Failed to read dashboard website reviews", error);
    return [];
  }
}

export async function updateDashboardWebsiteReviewStatus(
  id: string,
  status: WebsiteReviewModerationStatus,
) {
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getSql()),
  ]);

  if (
    !access.ok ||
    !canManageWorkspaceSettings(access) ||
    !sql ||
    !uuidPattern.test(id) ||
    !isWebsiteReviewStatus(status)
  ) {
    return false;
  }

  try {
    const rows = await persistWebsiteReviewModeration({
      sql,
      actorUserId: access.userId,
      workspaceId: access.workspaceId,
      reviewId: id,
      nextStatus: status,
    });
    return Boolean(rows[0]?.id);
  } catch (error) {
    console.error("Failed to moderate website review", error);
    return false;
  }
}

export async function updateDashboardWebsiteReview(id: string, input: unknown) {
  const parsed = websiteReviewEditSchema.safeParse(input);
  const [access, sql] = await Promise.all([
    getUserWorkspaceAccess(),
    Promise.resolve(getSql()),
  ]);

  if (
    !parsed.success ||
    !access.ok ||
    !canManageWorkspaceSettings(access) ||
    !sql ||
    !uuidPattern.test(id)
  ) {
    return false;
  }

  try {
    const rows = await persistWebsiteReviewEdit({
      sql,
      actorUserId: access.userId,
      workspaceId: access.workspaceId,
      reviewId: id,
      review: parsed.data,
    });
    return Boolean(rows[0]?.id);
  } catch (error) {
    console.error("Failed to edit website review", error);
    return false;
  }
}
