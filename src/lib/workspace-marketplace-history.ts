import "server-only";

import { getSql } from "@/lib/db/server";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export type WorkspaceMarketplaceHistory = {
  jobs: Array<{
    id: string;
    status: string;
    serviceName: string;
    city: string;
    amountMinor: number;
    currency: string;
    createdAt: string;
  }>;
  reputation: null | {
    profileId: string;
    rating: number;
    verifiedReviews: number;
    completedJobs: number;
    providerCancellations: number;
    customerCancellations: number;
    noShows: number;
    problemJobs: number;
  };
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compatibilityError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
}

export async function getWorkspaceMarketplaceHistory(): Promise<WorkspaceMarketplaceHistory> {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) return { jobs: [], reputation: null };
  const sql = getSql();
  if (!sql) return { jobs: [], reputation: null };

  try {
    const [jobRows, reputationRows] = await Promise.all([
      sql`
        select
          job.id::text,
          job.status,
          job.service_name,
          job.city,
          job.amount_minor,
          job.currency,
          job.created_at::text
        from marketplace_workspace_service_jobs job
        where job.resolved_workspace_id = ${access.workspaceId}::uuid
        order by job.created_at desc
        limit 100
      `,
      sql`
        select
          reputation.profile_id::text,
          reputation.rating,
          reputation.verified_review_count,
          reputation.completed_jobs,
          reputation.provider_cancelled_jobs,
          reputation.customer_cancelled_jobs,
          reputation.no_show_jobs,
          reputation.problem_jobs
        from marketplace_workspace_profile_reputation reputation
        where reputation.resolved_workspace_id = ${access.workspaceId}::uuid
        order by reputation.verified_review_count desc, reputation.completed_jobs desc, reputation.profile_id
        limit 1
      `,
    ]);

    const reputation = reputationRows[0]
      ? {
          profileId: text(reputationRows[0].profile_id),
          rating: number(reputationRows[0].rating),
          verifiedReviews: number(reputationRows[0].verified_review_count),
          completedJobs: number(reputationRows[0].completed_jobs),
          providerCancellations: number(reputationRows[0].provider_cancelled_jobs),
          customerCancellations: number(reputationRows[0].customer_cancelled_jobs),
          noShows: number(reputationRows[0].no_show_jobs),
          problemJobs: number(reputationRows[0].problem_jobs),
        }
      : null;

    return {
      jobs: jobRows.map((row) => ({
        id: text(row.id),
        status: text(row.status),
        serviceName: text(row.service_name),
        city: text(row.city),
        amountMinor: number(row.amount_minor),
        currency: text(row.currency) || "SEK",
        createdAt: text(row.created_at),
      })),
      reputation,
    };
  } catch (error) {
    if (compatibilityError(error)) return { jobs: [], reputation: null };
    throw error;
  }
}
