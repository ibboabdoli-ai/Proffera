import "server-only";

import { getSql } from "@/lib/db/server";
import {
  hashMarketplaceCustomerComparisonToken,
  isMarketplaceCustomerComparisonToken,
} from "@/lib/marketplace-customer-comparison";
import { hashMarketplaceGuestToken } from "@/lib/marketplace-guest-quote";
import { isValidMarketplaceGuestToken } from "@/lib/marketplace-guest-opt-out-core";

export type MarketplaceServiceJobStatus =
  | "accepted"
  | "in_progress"
  | "completed"
  | "customer_cancelled"
  | "provider_cancelled"
  | "no_show"
  | "problem";

export type MarketplaceServiceJobView = {
  id: string;
  status: MarketplaceServiceJobStatus;
  serviceName: string;
  city: string;
  currency: string;
  amountMinor: number;
  scheduledDate: string;
  completionSummary: string;
  resolutionReason: string;
  startedAt: string;
  completedAt: string;
  cancelledAt: string;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function databaseCompatibilityError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
}

function view(row: Record<string, unknown>): MarketplaceServiceJobView {
  return {
    id: text(row.id),
    status: text(row.status) as MarketplaceServiceJobStatus,
    serviceName: text(row.service_name),
    city: text(row.city),
    currency: text(row.currency) || "SEK",
    amountMinor: Number(row.amount_minor ?? 0),
    scheduledDate: text(row.scheduled_date),
    completionSummary: text(row.completion_summary),
    resolutionReason: text(row.resolution_reason),
    startedAt: text(row.started_at),
    completedAt: text(row.completed_at),
    cancelledAt: text(row.cancelled_at),
  };
}

export async function getMarketplaceServiceJobForGuestToken(
  token: string,
): Promise<MarketplaceServiceJobView | null> {
  if (!isValidMarketplaceGuestToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceGuestToken(token);

  try {
    const rows = await sql`
      select
        job.id::text,
        job.status,
        job.service_name,
        job.city,
        job.currency,
        job.amount_minor,
        job.scheduled_date::text,
        job.completion_summary,
        job.resolution_reason,
        job.started_at::text,
        job.completed_at::text,
        job.cancelled_at::text
      from marketplace_quote_invitations invitation
      join marketplace_quote_offers offer
        on offer.invitation_id = invitation.id
       and offer.status = 'selected'
      join marketplace_service_jobs job
        on job.selected_offer_id = offer.id
       and job.quote_request_id = offer.quote_request_id
       and job.profile_id = offer.profile_id
      where invitation.token_hash = ${tokenHash}
        and invitation.expires_at > now()
      limit 1
    `;
    return rows[0] ? view(rows[0] as Record<string, unknown>) : null;
  } catch (error) {
    if (databaseCompatibilityError(error)) return null;
    throw error;
  }
}

export async function getMarketplaceServiceJobForCustomerToken(
  token: string,
): Promise<MarketplaceServiceJobView | null> {
  if (!isMarketplaceCustomerComparisonToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceCustomerComparisonToken(token);

  try {
    const rows = await sql`
      select
        job.id::text,
        job.status,
        job.service_name,
        job.city,
        job.currency,
        job.amount_minor,
        job.scheduled_date::text,
        job.completion_summary,
        job.resolution_reason,
        job.started_at::text,
        job.completed_at::text,
        job.cancelled_at::text
      from marketplace_quote_customer_access access
      join marketplace_service_jobs job on job.quote_request_id = access.quote_request_id
      join marketplace_quote_offers offer on offer.id = job.selected_offer_id and offer.status = 'selected'
      where access.token_hash = ${tokenHash}
        and access.expires_at > now()
      limit 1
    `;
    return rows[0] ? view(rows[0] as Record<string, unknown>) : null;
  } catch (error) {
    if (databaseCompatibilityError(error)) return null;
    throw error;
  }
}

const providerStatuses = new Set<MarketplaceServiceJobStatus>([
  "in_progress",
  "completed",
  "provider_cancelled",
  "no_show",
  "problem",
]);

export async function transitionMarketplaceServiceJobByGuestToken(input: {
  token: string;
  nextStatus: MarketplaceServiceJobStatus;
  reason?: string;
  completionSummary?: string;
}) {
  if (!isValidMarketplaceGuestToken(input.token) || !providerStatuses.has(input.nextStatus)) {
    return { ok: false as const, code: "invalid" as const };
  }
  const reason = String(input.reason ?? "").trim().slice(0, 1000);
  const completionSummary = String(input.completionSummary ?? "").trim().slice(0, 4000);
  if (input.nextStatus === "completed" && completionSummary.length < 3) {
    return { ok: false as const, code: "completion_required" as const };
  }
  if (["provider_cancelled", "no_show", "problem"].includes(input.nextStatus) && reason.length < 3) {
    return { ok: false as const, code: "reason_required" as const };
  }

  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const tokenHash = hashMarketplaceGuestToken(input.token);

  try {
    const rows = await sql`
      with target as (
        select job.id, job.status
        from marketplace_quote_invitations invitation
        join marketplace_quote_offers offer
          on offer.invitation_id = invitation.id
         and offer.status = 'selected'
        join marketplace_service_jobs job
          on job.selected_offer_id = offer.id
         and job.quote_request_id = offer.quote_request_id
         and job.profile_id = offer.profile_id
        where invitation.token_hash = ${tokenHash}
          and invitation.expires_at > now()
        for update of job
      ), updated as (
        update marketplace_service_jobs job
        set
          status = ${input.nextStatus},
          started_at = case
            when ${input.nextStatus} = 'in_progress' then coalesce(job.started_at, now())
            else job.started_at
          end,
          completed_at = case when ${input.nextStatus} = 'completed' then now() else null end,
          cancelled_at = case
            when ${input.nextStatus} in ('provider_cancelled', 'no_show') then now()
            else null
          end,
          completion_summary = case
            when ${input.nextStatus} = 'completed' then ${completionSummary}
            else job.completion_summary
          end,
          resolution_reason = case
            when ${input.nextStatus} in ('provider_cancelled', 'no_show', 'problem') then ${reason}
            else job.resolution_reason
          end,
          updated_at = now()
        from target
        where job.id = target.id
          and (
            (target.status = 'accepted' and ${input.nextStatus} in ('in_progress', 'provider_cancelled', 'no_show', 'problem'))
            or (target.status = 'in_progress' and ${input.nextStatus} in ('completed', 'provider_cancelled', 'problem'))
            or (target.status = 'problem' and ${input.nextStatus} in ('in_progress', 'completed', 'provider_cancelled'))
          )
        returning job.*, target.status as previous_status
      ), event_record as (
        insert into marketplace_service_job_events (
          service_job_id, actor_type, event_type, from_status, to_status, reason
        )
        select
          updated.id,
          'provider',
          'status_changed',
          updated.previous_status,
          updated.status,
          case when updated.status = 'completed' then updated.completion_summary else coalesce(updated.resolution_reason, '') end
        from updated
        returning id
      )
      select updated.* from updated
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false as const, code: "transition" as const };
    return { ok: true as const, job: view(row) };
  } catch (error) {
    if (databaseCompatibilityError(error)) return { ok: false as const, code: "unavailable" as const };
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("marketplace_service_job_invalid_transition")) {
      return { ok: false as const, code: "transition" as const };
    }
    console.error("Failed to transition Marketplace ServiceJob", error);
    return { ok: false as const, code: "database" as const };
  }
}

export async function cancelMarketplaceServiceJobByCustomerToken(token: string, reasonInput?: string) {
  if (!isMarketplaceCustomerComparisonToken(token)) {
    return { ok: false as const, code: "invalid" as const };
  }
  const reason = String(reasonInput ?? "Customer cancelled the service").trim().slice(0, 1000)
    || "Customer cancelled the service";
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const tokenHash = hashMarketplaceCustomerComparisonToken(token);

  try {
    const rows = await sql`
      with target as (
        select job.id, job.status
        from marketplace_quote_customer_access access
        join marketplace_service_jobs job on job.quote_request_id = access.quote_request_id
        join marketplace_quote_offers offer on offer.id = job.selected_offer_id and offer.status = 'selected'
        where access.token_hash = ${tokenHash}
          and access.expires_at > now()
        for update of job
      ), updated as (
        update marketplace_service_jobs job
        set
          status = 'customer_cancelled',
          cancelled_at = now(),
          completed_at = null,
          resolution_reason = ${reason},
          updated_at = now()
        from target
        where job.id = target.id
          and target.status in ('accepted', 'in_progress', 'problem')
        returning job.*, target.status as previous_status
      ), event_record as (
        insert into marketplace_service_job_events (
          service_job_id, actor_type, event_type, from_status, to_status, reason
        )
        select updated.id, 'customer', 'status_changed', updated.previous_status, 'customer_cancelled', ${reason}
        from updated
        returning id
      )
      select updated.* from updated
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false as const, code: "closed" as const };
    return { ok: true as const, job: view(row) };
  } catch (error) {
    if (databaseCompatibilityError(error)) return { ok: false as const, code: "unavailable" as const };
    console.error("Failed to cancel Marketplace ServiceJob", error);
    return { ok: false as const, code: "database" as const };
  }
}
