import "server-only";

import { getSql } from "@/lib/db/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export type MarketplaceReviewModerationItem = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reviewerName: string;
  rating: number;
  service: string;
  area: string;
  message: string;
  createdAt: string;
  companyName: string;
  profileSlug: string;
  serviceJobId: string;
};

export async function listMarketplaceReviewModerationItems(): Promise<MarketplaceReviewModerationItem[]> {
  const sql = getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      select
        review.id::text,
        review.status,
        review.reviewer_name,
        review.rating,
        review.service,
        review.area,
        review.message,
        review.created_at::text,
        review.marketplace_service_job_id::text as service_job_id,
        profile.display_name,
        profile.public_slug
      from website_reviews review
      join marketplace_service_jobs job on job.id = review.marketplace_service_job_id
      join company_directory_profiles profile on profile.id = review.profile_id
      where review.marketplace_service_job_id is not null
        and review.profile_id = job.profile_id
        and review.is_verified = true
      order by
        case review.status when 'pending' then 0 when 'approved' then 1 else 2 end,
        review.created_at desc
      limit 100
    `;
    return rows.flatMap((row) => {
      const status = text(row.status);
      if (status !== "pending" && status !== "approved" && status !== "rejected") return [];
      return [{
        id: text(row.id),
        status,
        reviewerName: text(row.reviewer_name),
        rating: Number(row.rating ?? 0),
        service: text(row.service),
        area: text(row.area),
        message: text(row.message),
        createdAt: text(row.created_at),
        companyName: text(row.display_name),
        profileSlug: text(row.public_slug),
        serviceJobId: text(row.service_job_id),
      } satisfies MarketplaceReviewModerationItem];
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42P01" || code === "42703") return [];
    throw error;
  }
}

export async function moderateMarketplaceVerifiedReview(input: {
  reviewId: string;
  decision: "approved" | "rejected";
  adminUserId: string;
  reason?: string;
}) {
  if (!uuidPattern.test(input.reviewId) || !input.adminUserId) {
    return { ok: false as const, code: "invalid" as const };
  }
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const reason = String(input.reason ?? "").trim().slice(0, 1000);

  try {
    const rows = await sql`
      with target as (
        select
          review.id,
          review.status as previous_status,
          review.marketplace_service_job_id,
          review.profile_id
        from website_reviews review
        join marketplace_service_jobs job on job.id = review.marketplace_service_job_id
        where review.id = ${input.reviewId}::uuid
          and review.marketplace_service_job_id is not null
          and review.profile_id = job.profile_id
          and review.is_verified = true
          and job.status = 'completed'
        for update of review
      ), updated as (
        update website_reviews review
        set
          status = ${input.decision},
          moderated_at = now(),
          moderated_by_user_id = ${input.adminUserId},
          published_at = case when ${input.decision} = 'approved' then coalesce(review.published_at, now()) else null end,
          updated_at = now()
        from target
        where review.id = target.id
          and review.status = 'pending'
        returning review.id::text, review.status, target.previous_status, review.marketplace_service_job_id::text, review.profile_id::text
      ), audit as (
        insert into admin_audit_logs (
          admin_user_id,
          workspace_id,
          action,
          reason,
          previous_value,
          new_value
        )
        select
          ${input.adminUserId},
          null,
          ${input.decision === "approved" ? "marketplace_review.approved" : "marketplace_review.rejected"},
          ${reason || (input.decision === "approved" ? "Verified Marketplace review approved" : "Verified Marketplace review rejected")},
          jsonb_build_object('review_id', updated.id, 'status', updated.previous_status),
          jsonb_build_object(
            'review_id', updated.id,
            'status', updated.status,
            'service_job_id', updated.marketplace_service_job_id,
            'profile_id', updated.profile_id
          )
        from updated
        returning id
      )
      select updated.* from updated
    `;
    if (!rows[0]) return { ok: false as const, code: "closed" as const };
    return { ok: true as const, status: input.decision };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42P01" || code === "42703") return { ok: false as const, code: "unavailable" as const };
    console.error("Failed to moderate Marketplace verified review", error);
    return { ok: false as const, code: "database" as const };
  }
}
