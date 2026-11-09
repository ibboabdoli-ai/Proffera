import "server-only";

import { getSql } from "@/lib/db/server";

/**
 * Append-only outcome history for a manager's status-email retry. The booking
 * may have changed revision while Brevo handled the request: record the
 * exact loaded revision, NEVER mutate the earlier attempt or current notice.
 */
export async function recordMariaStatusRetryAudit(input: {
  workspaceId: string;
  bookingId: string;
  status: "confirmed" | "cancelled";
  revision: string;
  outcome: "accepted" | "uncertain" | "failed";
  parentEventId: string | null;
}): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  const rows = await sql`
    insert into customer_events (
      workspace_id,customer_id,booking_id,event_type,title,description,metadata)
    select b.workspace_id,b.customer_id,b.id,'note',
      'Maria status email retry',
      ${input.outcome === "accepted"
        ? "Email provider accepted a Maria retry for the recorded booking revision."
        : input.outcome === "uncertain"
          ? "Maria retry outcome uncertain; verify Brevo before any new attempt."
          : "Maria retry was not confirmed; manual follow-up required."},
      jsonb_build_object(
        'source','maria_status_retry',
        'new_status',${input.status}::text,
        'notice_revision',${input.revision}::text,
        'notice_customer',${input.outcome}::text,
        'notice_parent_event_id',${input.parentEventId}::text,
        'is_current_revision',(
          b.status=${input.status}
          and date_trunc('milliseconds',b.updated_at)=${input.revision}::timestamptz))
    from bookings b where b.id=${input.bookingId}::uuid
      and b.workspace_id=${input.workspaceId}
    returning id
  `;
  return rows.length === 1;
}

/**
 * Read the actual booking revision in PostgreSQL before permitting a retry.
 * Any accepted or uncertain attempt for this revision blocks another send.
 * Historical attempts attached to older revisions do not change this gate.
 */
export async function getMariaStatusRetryGate(input: {
  workspaceId: string;
  bookingId: string;
  status: "confirmed" | "cancelled";
  revision: string;
}): Promise<"accepted" | "uncertain" | "retryable" | "revision_changed"> {
  const sql = getSql();
  if (!sql) return "revision_changed";
  const rows = await sql`
    select case
      when count(*) filter (where e.metadata->>'notice_customer'='accepted') > 0 then 'accepted'
      when count(*) filter (where e.metadata->>'notice_customer' in ('uncertain','sending')) > 0
        then 'uncertain'
      else 'retryable' end as gate
    from bookings b
    left join customer_events e on e.workspace_id=b.workspace_id and e.booking_id=b.id
      and e.event_type in ('status_change','note')
      and e.metadata->>'source' in ('dashboard_manual','maria_status_retry')
      and e.metadata->>'new_status'=b.status
      and e.metadata->>'notice_revision' is not null
      and (e.metadata->>'notice_revision')::timestamptz=date_trunc('milliseconds',b.updated_at)
    where b.workspace_id=${input.workspaceId} and b.id=${input.bookingId}::uuid
      and b.status=${input.status}
      and date_trunc('milliseconds',b.updated_at)=${input.revision}::timestamptz
    having count(b.id)>0
  `;
  const gate = String(rows[0]?.gate ?? "");
  return gate === "accepted" || gate === "uncertain" || gate === "retryable"
    ? gate : "revision_changed";
}
