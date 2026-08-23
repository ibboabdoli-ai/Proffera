import "server-only";

import { getSql } from "@/lib/db/server";

export const MARKETPLACE_AUTO_QUEUE_PAGE_SIZE = 50;

export type MarketplaceAutoQueueRow = {
  quoteRequestId: string;
  createdAt: string;
  submittedOfferCount: number;
  priorityRank: 0 | 1;
};

export type MarketplaceAutoQueuePageResult =
  | { ok: true; rows: MarketplaceAutoQueueRow[] }
  | { ok: false; message: string; rows: MarketplaceAutoQueueRow[] };

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function boundedLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return MARKETPLACE_AUTO_QUEUE_PAGE_SIZE;
  return Math.max(1, Math.min(MARKETPLACE_AUTO_QUEUE_PAGE_SIZE, Math.floor(value as number)));
}

function uuid(value: unknown) {
  const normalized = text(value).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : "";
}

function rolloutCutoff(value: string | undefined) {
  const normalized = text(value);
  if (!normalized) return "";
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

export async function getMarketplaceAutoQueuePage(input: {
  priorityQuoteRequestIds?: string[];
  afterPriorityRank?: number | null;
  afterCreatedAt?: string | null;
  afterId?: string | null;
  limit?: number;
} = {}): Promise<MarketplaceAutoQueuePageResult> {
  const sql = getSql();
  if (!sql) {
    return {
      ok: false,
      message: "Databasen är inte konfigurerad.",
      rows: [],
    };
  }

  const priorityCsv = [...new Set((input.priorityQuoteRequestIds ?? []).map(uuid).filter(Boolean))].slice(0, 10).join(",");
  const afterPriorityRank = input.afterPriorityRank === 0 || input.afterPriorityRank === 1
    ? input.afterPriorityRank
    : null;
  const afterCreatedAt = text(input.afterCreatedAt);
  const afterId = text(input.afterId).toLowerCase();
  const notBefore = rolloutCutoff(process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE);
  const limit = boundedLimit(input.limit);

  try {
    const rows = await sql`
      with queued as (
        select
          request.id::text as quote_request_id,
          request.created_at as created_at_sort,
          case
            when request.id = any(string_to_array(nullif(${priorityCsv}, ''), ',')::uuid[]) then 0
            else 1
          end::int as priority_rank,
          (
            select count(*)::int
            from marketplace_quote_offers offer
            where offer.quote_request_id = request.id
              and offer.status in ('submitted', 'selected')
          ) as submitted_offer_count
        from quote_requests request
        where request.status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
          and (
            nullif(${notBefore}, '')::timestamptz is null
            or request.created_at >= nullif(${notBefore}, '')::timestamptz
          )
      )
      select
        quote_request_id,
        created_at_sort::text as created_at,
        priority_rank,
        submitted_offer_count
      from queued
      where (
        ${afterPriorityRank}::int is null
        or priority_rank > ${afterPriorityRank}::int
        or (
          priority_rank = ${afterPriorityRank}::int
          and (
            created_at_sort > nullif(${afterCreatedAt}, '')::timestamptz
            or (
              created_at_sort = nullif(${afterCreatedAt}, '')::timestamptz
              and quote_request_id > ${afterId}
            )
          )
        )
      )
      order by priority_rank asc, created_at_sort asc, quote_request_id asc
      limit ${limit}
    `;

    return {
      ok: true,
      rows: (rows as Record<string, unknown>[]).map((row): MarketplaceAutoQueueRow => ({
        quoteRequestId: text(row.quote_request_id),
        createdAt: text(row.created_at),
        submittedOfferCount: Math.max(0, Number(row.submitted_offer_count ?? 0) || 0),
        priorityRank: Number(row.priority_rank) === 0 ? 0 : 1,
      })).filter((row) => Boolean(row.quoteRequestId && row.createdAt)),
    };
  } catch (error) {
    console.error("Failed to load Marketplace Auto Worker queue", { error });
    return {
      ok: false,
      message: "Kunde inte läsa Marketplace-kön.",
      rows: [],
    };
  }
}
