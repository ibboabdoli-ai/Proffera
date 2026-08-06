import type { getSql } from "@/lib/db/server";

export const QUOTE_REQUEST_STATUSES = [
  "submitted",
  "pending_review",
  "approved",
  "matched",
  "answered",
  "booked",
  "completed",
  "cancelled",
  "rejected",
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
export type QuoteRequestStatusSql = NonNullable<ReturnType<typeof getSql>>;

export function isQuoteRequestStatus(value: string): value is QuoteRequestStatus {
  return QUOTE_REQUEST_STATUSES.includes(value as QuoteRequestStatus);
}

export async function persistQuoteRequestStatusChange(input: {
  sql: QuoteRequestStatusSql;
  adminUserId: string;
  requestId: string;
  nextStatus: QuoteRequestStatus;
}) {
  const { sql, adminUserId, requestId, nextStatus } = input;

  return sql`
    with previous as (
      select id, reference_id, status
      from quote_requests
      where id = ${requestId}::uuid
      for update
    ),
    updated as (
      update quote_requests qr
      set status = ${nextStatus}, updated_at = now()
      from previous p
      where qr.id = p.id and p.status <> ${nextStatus}
      returning qr.id, p.reference_id, p.status as previous_status, qr.status as next_status
    )
    insert into admin_audit_logs (
      admin_user_id, action, reason, previous_value, new_value
    )
    select
      ${adminUserId},
      'quote_request.status_updated',
      'Quote request status changed from Quote Admin',
      jsonb_build_object('request_id', id, 'reference_id', reference_id, 'status', previous_status),
      jsonb_build_object('request_id', id, 'reference_id', reference_id, 'status', next_status)
    from updated
  `;
}
