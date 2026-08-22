import "server-only";

import { getSql } from "@/lib/db/server";
import {
  hashMarketplaceCustomerComparisonToken,
  isMarketplaceCustomerComparisonToken,
} from "@/lib/marketplace-customer-comparison";

export type MarketplaceRematchStatus = "pending" | "processing" | "processed" | "cancelled";

export type MarketplaceRematchView = {
  id: string;
  status: MarketplaceRematchStatus;
  sourceQuoteRequestId: string;
  rematchQuoteRequestId: string;
  rematchReferenceId: string;
  createdAt: string;
  processedAt: string;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function databaseCompatibilityError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
}

function view(row: Record<string, unknown>): MarketplaceRematchView {
  return {
    id: text(row.id),
    status: text(row.status) as MarketplaceRematchStatus,
    sourceQuoteRequestId: text(row.source_quote_request_id),
    rematchQuoteRequestId: text(row.rematch_quote_request_id),
    rematchReferenceId: text(row.rematch_reference_id),
    createdAt: text(row.created_at),
    processedAt: text(row.processed_at),
  };
}

export async function getMarketplaceRematchForCustomerToken(
  token: string,
): Promise<MarketplaceRematchView | null> {
  if (!isMarketplaceCustomerComparisonToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceCustomerComparisonToken(token);

  try {
    const rows = await sql`
      select
        rematch.id::text,
        rematch.status,
        rematch.source_quote_request_id::text,
        rematch.rematch_quote_request_id::text,
        next_request.reference_id as rematch_reference_id,
        rematch.created_at::text,
        rematch.processed_at::text
      from marketplace_quote_customer_access access
      join marketplace_service_jobs job on job.quote_request_id = access.quote_request_id
      join marketplace_rematch_requests rematch on rematch.service_job_id = job.id
      join quote_requests next_request on next_request.id = rematch.rematch_quote_request_id
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

export async function requestMarketplaceRematchByCustomerToken(input: {
  token: string;
  reason?: string;
}) {
  if (!isMarketplaceCustomerComparisonToken(input.token)) {
    return { ok: false as const, code: "invalid" as const };
  }

  const reason = String(input.reason ?? "Customer requested a new provider")
    .trim()
    .slice(0, 1000) || "Customer requested a new provider";
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const tokenHash = hashMarketplaceCustomerComparisonToken(input.token);

  try {
    const [, rows] = await sql.transaction((txn) => [
      txn`
        select pg_advisory_xact_lock(hashtextextended(job.id::text, 0))
        from marketplace_quote_customer_access access
        join marketplace_service_jobs job on job.quote_request_id = access.quote_request_id
        where access.token_hash = ${tokenHash}
          and access.expires_at > now()
        limit 1
      `,
      txn`
        with target as (
          select
            job.id as service_job_id,
            job.quote_request_id as source_quote_request_id,
            job.status as job_status,
            request.*
          from marketplace_quote_customer_access access
          join marketplace_service_jobs job on job.quote_request_id = access.quote_request_id
          join quote_requests request on request.id = job.quote_request_id
          where access.token_hash = ${tokenHash}
            and access.expires_at > now()
          for update of job, request
        ), existing as (
          select
            rematch.id,
            rematch.status,
            rematch.source_quote_request_id,
            rematch.rematch_quote_request_id,
            next_request.reference_id as rematch_reference_id,
            rematch.created_at,
            rematch.processed_at
          from marketplace_rematch_requests rematch
          join target on target.service_job_id = rematch.service_job_id
          join quote_requests next_request on next_request.id = rematch.rematch_quote_request_id
        ), cloned as (
          insert into quote_requests (
            category,
            service_type,
            city,
            postal_code,
            customer_address_line1,
            customer_latitude,
            customer_longitude,
            customer_location_source,
            customer_verified_latitude,
            customer_verified_longitude,
            customer_location_verification_source,
            customer_location_verification_reference,
            customer_location_verified_at,
            description,
            preferred_date,
            contact_name,
            contact_email,
            contact_phone,
            consent_accepted,
            status,
            reference_id
          )
          select
            target.category,
            target.service_type,
            target.city,
            target.postal_code,
            target.customer_address_line1,
            target.customer_latitude,
            target.customer_longitude,
            target.customer_location_source,
            target.customer_verified_latitude,
            target.customer_verified_longitude,
            target.customer_location_verification_source,
            target.customer_location_verification_reference,
            target.customer_location_verified_at,
            target.description,
            target.preferred_date,
            target.contact_name,
            target.contact_email,
            target.contact_phone,
            target.consent_accepted,
            'draft',
            'PRO-R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
          from target
          where target.job_status in ('customer_cancelled', 'provider_cancelled', 'no_show', 'problem')
            and target.consent_accepted = true
            and not exists (select 1 from existing)
          returning id, reference_id
        ), inserted as (
          insert into marketplace_rematch_requests (
            service_job_id,
            source_quote_request_id,
            rematch_quote_request_id,
            status,
            reason
          )
          select
            target.service_job_id,
            target.source_quote_request_id,
            cloned.id,
            'pending',
            ${reason}
          from target
          join cloned on true
          on conflict (service_job_id) do nothing
          returning id, status, source_quote_request_id, rematch_quote_request_id, created_at, processed_at
        )
        select
          existing.id::text,
          existing.status,
          existing.source_quote_request_id::text,
          existing.rematch_quote_request_id::text,
          existing.rematch_reference_id,
          existing.created_at::text,
          existing.processed_at::text,
          true as already_exists
        from existing
        union all
        select
          inserted.id::text,
          inserted.status,
          inserted.source_quote_request_id::text,
          inserted.rematch_quote_request_id::text,
          cloned.reference_id as rematch_reference_id,
          inserted.created_at::text,
          inserted.processed_at::text,
          false as already_exists
        from inserted
        join cloned on cloned.id = inserted.rematch_quote_request_id
        limit 1
      `,
    ], { isolationMode: "ReadCommitted" } as unknown as Parameters<typeof sql.transaction>[1]);

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false as const, code: "not_eligible" as const };
    return {
      ok: true as const,
      code: row.already_exists ? "already_requested" as const : "requested" as const,
      rematch: view(row),
    };
  } catch (error) {
    if (databaseCompatibilityError(error)) return { ok: false as const, code: "unavailable" as const };
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("marketplace_rematch_generation_not_eligible")) {
      return { ok: false as const, code: "not_eligible" as const };
    }
    console.error("Failed to create Marketplace rematch generation", error);
    return { ok: false as const, code: "database" as const };
  }
}
