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
      when count(*) filter (where
        e.metadata->>'notice_customer' in ('uncertain','sending','pending')
        or (e.metadata->>'source'='customer_portal'
          and e.metadata->>'notice_revision' is null)
      ) > 0 then 'uncertain'
      else 'retryable' end as gate
    from bookings b
    left join customer_events e on e.workspace_id=b.workspace_id and e.booking_id=b.id
      and e.event_type in ('status_change','note')
      and e.metadata->>'source' in ('dashboard_manual','maria_status_retry','customer_portal')
      and e.metadata->>'new_status'=b.status
      and (
        (e.metadata->>'notice_revision' is not null
          and (e.metadata->>'notice_revision')::timestamptz=date_trunc('milliseconds',b.updated_at))
        or (b.status='cancelled' and e.metadata->>'source'='customer_portal'
          and e.metadata->>'notice_revision' is null)
      )
    where b.workspace_id=${input.workspaceId} and b.id=${input.bookingId}::uuid
      and b.status=${input.status}
      and date_trunc('milliseconds',b.updated_at)=${input.revision}::timestamptz
    having count(b.id)>0
  `;
  const gate = String(rows[0]?.gate ?? "");
  return gate === "accepted" || gate === "uncertain" || gate === "retryable"
    ? gate : "revision_changed";
}


/**
 * Claim an exact booking revision before contacting Brevo. The advisory lock
 * serializes concurrent manager retries with customer portal/manager status
 * mutations; a durable 'sending' record survives a crash or lost response.
 * Never steal old 'sending' claims based only on their age.
 */
export async function claimMariaStatusRetry(input: {
  workspaceId: string; bookingId: string;
  status: "confirmed" | "cancelled"; revision: string;
  parentEventId: string | null;
}): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  const results = await sql.transaction([
    sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text,713))`,
    sql`
      insert into customer_events (
        workspace_id,customer_id,booking_id,event_type,title,description,metadata)
      select b.workspace_id,b.customer_id,b.id,'note',
        'Maria status email retry claimed',
        'Maria retry claimed for this booking revision. Provider outcome not yet known.',
        jsonb_build_object(
          'source','maria_status_retry',
          'new_status',${input.status}::text,
          'notice_revision',${input.revision}::text,
          'notice_customer','sending',
          'notice_attempted_at',now()::text,
          'notice_parent_event_id',${input.parentEventId}::text)
      from bookings b where b.id=${input.bookingId}::uuid
        and b.workspace_id=${input.workspaceId}
        and b.status=${input.status}
        and date_trunc('milliseconds',b.updated_at)=${input.revision}::timestamptz
        and not exists (
          select 1 from customer_events e
          where e.workspace_id=b.workspace_id and e.booking_id=b.id
            and e.event_type in ('status_change','note')
            and e.metadata->>'source' in ('dashboard_manual','maria_status_retry','customer_portal')
            and e.metadata->>'new_status'=b.status
            and (
              (e.metadata->>'notice_revision' is not null
                and (e.metadata->>'notice_revision')::timestamptz=date_trunc('milliseconds',b.updated_at))
              or (b.status='cancelled' and e.metadata->>'source'='customer_portal'
                and e.metadata->>'notice_revision' is null)
            )
            and (
              e.metadata->>'notice_customer' in ('accepted','uncertain','sending','pending')
              or (e.metadata->>'source'='customer_portal'
                and e.metadata->>'notice_revision' is null)
            )
        )
      returning id::text
    `,
  ]);
  return results[1]?.[0]?.id ? String(results[1][0].id) : null;
}

/**
 * Complete ONLY the exact claimed event. If Brevo accepted but this write
 * fails, 'sending' remains blocked until provider-side reconciliation.
 * Revision changes are recorded in history, never on a new booking notice.
 */
export async function finishMariaStatusRetry(input: {
  workspaceId: string; bookingId: string; claimId: string;
  status: "confirmed" | "cancelled"; revision: string;
  outcome: "accepted" | "uncertain" | "failed";
}): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  const rows = await sql`
    update customer_events e
    set metadata=e.metadata || jsonb_build_object(
      'notice_customer',${input.outcome}::text,
      'is_current_revision',(
        b.status=${input.status}
        and date_trunc('milliseconds',b.updated_at)=${input.revision}::timestamptz)),
      description=${input.outcome === "accepted"
        ? "Email provider accepted retry request for the claimed booking revision."
        : input.outcome === "uncertain"
          ? "Email retry outcome uncertain. Reconcile with provider before another send."
          : "Email retry definitely failed before provider acceptance."}
    from bookings b
    where e.id=${input.claimId}::uuid
      and e.workspace_id=${input.workspaceId}
      and e.booking_id=${input.bookingId}::uuid
      and e.metadata->>'source'='maria_status_retry'
      and e.metadata->>'new_status'=${input.status}
      and e.metadata->>'notice_revision'=${input.revision}
      and e.metadata->>'notice_customer'='sending'
      and b.id=e.booking_id and b.workspace_id=e.workspace_id
    returning e.id
  `;
  return rows.length === 1;
}
