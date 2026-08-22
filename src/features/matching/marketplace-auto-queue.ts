import "server-only";

import { getSql } from "@/lib/db/server";

export const MARKETPLACE_AUTO_QUEUE_PAGE_SIZE = 50;

export type MarketplaceAutoQueueRow = {
  quoteRequestId: string;
  createdAt: string;
  submittedOfferCount: number;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function boundedLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return MARKETPLACE_AUTO_QUEUE_PAGE_SIZE;
  return Math.max(1, Math.min(MARKETPLACE_AUTO_QUEUE_PAGE_SIZE, Math.floor(value as number)));
}

export async function getMarketplaceAutoQueuePage(input: {
  afterCreatedAt?: string | null;
  afterId?: string | null;
  limit?: number;
} = {}) {
  const sql = getSql();
  if (!sql) {
    return {
      ok: false as const,
      message: "Databasen är inte konfigurerad.",
      rows: [] as MarketplaceAutoQueueRow[],
    };
  }

  const afterCreatedAt = text(input.afterCreatedAt);
  const afterId = text(input.afterId).toLowerCase();
  const limit = boundedLimit(input.limit);

  try {
    const rows = await sql`
      select
        request.id::text as quote_request_id,
        request.created_at::text as created_at,
        (
          select count(*)::int
          from marketplace_quote_offers offer
          where offer.quote_request_id = request.id
            and offer.status in ('submitted', 'selected')
        ) as submitted_offer_count
      from quote_requests request
      where request.status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
        and (
          nullif(${afterCreatedAt}, '') is null
          or request.created_at > nullif(${afterCreatedAt}, '')::timestamptz
          or (
            request.created_at = nullif(${afterCreatedAt}, '')::timestamptz
            and request.id::text > ${afterId}
          )
        )
      order by request.created_at asc, request.id asc
      limit ${limit}
    `;

    return {
      ok: true as const,
      rows: (rows as Record<string, unknown>[]).map((row) => ({
        quoteRequestId: text(row.quote_request_id),
        createdAt: text(row.created_at),
        submittedOfferCount: Math.max(0, Number(row.submitted_offer_count ?? 0) || 0),
      })).filter((row) => Boolean(row.quoteRequestId && row.createdAt)),
    };
  } catch (error) {
    console.error("Failed to load Marketplace Auto Worker queue", { error });
    return {
      ok: false as const,
      message: "Kunde inte läsa Marketplace-kön.",
      rows: [] as MarketplaceAutoQueueRow[],
    };
  }
}
