import { getAdminForArea } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

export type AdminMarketplaceFunnelSnapshot = {
  requests: number;
  invitedRequests: number;
  viewedRequests: number;
  respondedRequests: number;
  offeredRequests: number;
  selectedRequests: number;
  serviceJobRequests: number;
  completedJobRequests: number;
  verifiedReviewRequests: number;
  claimedRequests: number;
  paidRequests: number;
  windowDays: 30;
};

export type AdminMarketplaceFunnelResult =
  | { ok: true; snapshot: AdminMarketplaceFunnelSnapshot }
  | { ok: false; message: string };

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Returns a privacy-safe, read-only 30-day Marketplace funnel for Quote Admin.
 * Counts are request-level so multiple invitation waves, offers, lifecycle
 * events, reviews, claims, or subscriptions do not inflate conversion stages.
 * Claim/Paid attribution requires the Marketplace invitation's explicit linked
 * Workspace plus the corresponding claimed Company Directory claim. Paid then
 * uses only the canonical Stripe-synchronised billing subscription state. No
 * customer contact fields are selected or returned.
 */
export async function getAdminMarketplaceFunnelSnapshot(): Promise<AdminMarketplaceFunnelResult> {
  const admin = await getAdminForArea("quote_admin");
  const sql = getSql();

  if (!admin) {
    return { ok: false, message: "Du saknar behörighet till Quote Admin." };
  }
  if (!sql) {
    return { ok: false, message: "Databasen är inte konfigurerad ännu." };
  }

  try {
    const rows = await sql`
      with recent_requests as (
        select request.id, request.created_at
        from quote_requests request
        where request.created_at >= now() - interval '30 days'
      )
      select
        count(*) as requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_invitations invitation
            where invitation.quote_request_id = request.id
          )
        ) as invited_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_invitations invitation
            where invitation.quote_request_id = request.id
              and invitation.viewed_at is not null
          )
        ) as viewed_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_invitations invitation
            where invitation.quote_request_id = request.id
              and invitation.responded_at is not null
          )
        ) as responded_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_offers offer
            where offer.quote_request_id = request.id
          )
        ) as offered_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_offers offer
            where offer.quote_request_id = request.id
              and offer.status = 'selected'
              and offer.selected_at is not null
          )
        ) as selected_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_service_jobs job
            where job.quote_request_id = request.id
          )
        ) as service_job_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_service_jobs job
            where job.quote_request_id = request.id
              and job.status = 'completed'
              and job.completed_at is not null
          )
        ) as completed_job_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_service_jobs job
            join website_reviews review
              on review.marketplace_service_job_id = job.id
            where job.quote_request_id = request.id
              and review.is_verified = true
              and review.status = 'approved'
          )
        ) as verified_review_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_invitations invitation
            join company_directory_claims claim
              on claim.profile_id = invitation.profile_id
             and claim.requested_workspace_id = invitation.workspace_id
            where invitation.quote_request_id = request.id
              and invitation.workspace_id is not null
              and claim.status = 'claimed'
              and claim.resolved_at is not null
              and claim.resolved_at >= request.created_at
          )
        ) as claimed_requests,
        count(*) filter (
          where exists (
            select 1
            from marketplace_quote_invitations invitation
            join company_directory_claims claim
              on claim.profile_id = invitation.profile_id
             and claim.requested_workspace_id = invitation.workspace_id
            join workspace_billing_subscriptions billing
              on billing.workspace_id = invitation.workspace_id
            where invitation.quote_request_id = request.id
              and invitation.workspace_id is not null
              and claim.status = 'claimed'
              and claim.resolved_at is not null
              and claim.resolved_at >= request.created_at
              and billing.stripe_subscription_id is not null
              and billing.status in ('active', 'trialing')
              and billing.created_at >= claim.resolved_at
          )
        ) as paid_requests
      from recent_requests request
    `;
    const row = rows[0] ?? {};

    return {
      ok: true,
      snapshot: {
        requests: count(row.requests),
        invitedRequests: count(row.invited_requests),
        viewedRequests: count(row.viewed_requests),
        respondedRequests: count(row.responded_requests),
        offeredRequests: count(row.offered_requests),
        selectedRequests: count(row.selected_requests),
        serviceJobRequests: count(row.service_job_requests),
        completedJobRequests: count(row.completed_job_requests),
        verifiedReviewRequests: count(row.verified_review_requests),
        claimedRequests: count(row.claimed_requests),
        paidRequests: count(row.paid_requests),
        windowDays: 30,
      },
    };
  } catch (error) {
    console.error("Failed to read Marketplace funnel snapshot", error);
    return {
      ok: false,
      message: "Kunde inte läsa Marketplace-funneln.",
    };
  }
}
