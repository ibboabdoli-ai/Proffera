import "server-only";

import { getSql } from "@/lib/db/server";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { MARIA_DEPOSIT_AMOUNT_SEK, mariaBookingNumber } from "@/lib/maria-deposit";
import { isMariaProductionSwishAuthorized } from "@/lib/maria-production-activation-policy";
import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

const source = "maria_swish_manual_deposit_v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManualSwishState = "paid" | "unverified";
export type ManualSwishEntry = { state: ManualSwishState; markedAt: string; reference?: string };
export type ManualSwishStatusRead = {
  ok: boolean;
  entries: Record<string, ManualSwishEntry>;
};

/** Require Maria manager permissions and ready Production lifecycle, if live. */
async function requireMariaManager() {
  const access = await getUserWorkspaceAccess();
  const preview = process.env.VERCEL_ENV === "preview";
  const production = process.env.VERCEL_ENV === "production";
  if ((!preview && !production)
    || !access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)
    || (preview && !(await hasDashboardModuleAccess("online_booking")))) {
    throw new Error("MARIA_MANUAL_SWISH_FORBIDDEN");
  }
  if (production) {
    if (process.env.PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED !== "true") {
      throw new Error("MARIA_MANUAL_SWISH_FORBIDDEN");
    }
    const ready = await getMariaBookingReadiness();
    if ((!ready.enabled || ready.workspaceId !== access.workspaceId)
      && !isMariaProductionSwishAuthorized()) {
      throw new Error("MARIA_MANUAL_SWISH_FORBIDDEN");
    }
  }
  return access;
}

/** Dashboard only: a manual record, never a bank-confirmed payment. */
export async function readMariaManualSwishStatuses(): Promise<ManualSwishStatusRead> {
  try {
    const access = await requireMariaManager();
    const approvedRecipient = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
    if (process.env.VERCEL_ENV === "preview" && (!approvedRecipient || !isMariaPreviewTestRecipient(approvedRecipient))) return { ok: false, entries: {} };
    const sql = getSql();
    if (!sql) return { ok: false, entries: {} };
    const rows = await sql`
      select b.id::text as booking_id,
        ref.reference as booking_reference,
        latest.metadata->>'state' as state,
        latest.created_at::text as marked_at
      from bookings b
      join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
        and (${process.env.VERCEL_ENV !== "preview"}::boolean or lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))=${approvedRecipient ?? ""})
      left join maria_booking_references ref on ref.booking_id=b.id
      left join lateral (
        select e.metadata, e.created_at
        from customer_events e
        where e.workspace_id = b.workspace_id
          and e.booking_id = b.id
          and e.event_type = 'note'
          and e.metadata->>'source' = ${source}
          and e.metadata->>'state' in ('paid', 'unverified')
        order by e.created_at desc, e.id desc
        limit 1
      ) latest on true
      where b.workspace_id = ${access.workspaceId}
        and b.customer_id is not null
        and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    `;
    const entries: Record<string, ManualSwishEntry> = {};
    for (const row of rows) {
      const bookingId = String(row.booking_id ?? "");
      if (uuid.test(bookingId)) {
        entries[bookingId] = {
          state: row.state === "paid" ? "paid" : "unverified",
          markedAt: String(row.marked_at ?? ""),
          ...(typeof row.booking_reference === "string"
            ? { reference: mariaBookingNumber(bookingId, row.booking_reference) } : {}),
        };
      }
    }
    return { ok: true, entries };
  } catch (error) {
    console.error("Maria manual Swish status could not be read", error);
    return { ok: false, entries: {} };
  }
}

/** A signed-in Maria manager records what they independently checked in Swish. */
export async function setMariaManualSwishStatus(bookingId: string, state: ManualSwishState) {
  if (!uuid.test(bookingId) || (state !== "paid" && state !== "unverified")) {
    throw new Error("MARIA_MANUAL_SWISH_INVALID");
  }
  const access = await requireMariaManager();
  const approvedRecipient = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  if (process.env.VERCEL_ENV === "preview" && (!approvedRecipient || !isMariaPreviewTestRecipient(approvedRecipient))) {
    throw new Error("MARIA_MANUAL_SWISH_FORBIDDEN");
  }
  const normalizedBookingId = bookingId.toLowerCase();
  const sql = getSql();
  if (!sql) throw new Error("MARIA_MANUAL_SWISH_DATABASE");
  const title = state === "paid"
    ? "Swish-handpenning manuellt markerad som betald"
    : "Manuell Swish-betalningsmarkering ångrad";
  const description = state === "paid"
    ? "Administratören har kontrollerat Swish och markerat handpenning 2 000 kr som mottagen."
    : "Administratören har återställt betalningsstatus till ej verifierad.";
  // Match the status-email dispatch lock BEFORE the per-booking Swish lock:
  // payment state cannot change after status-email preflight but before Brevo.
  // Existing booked deposits stay manageable while new intake is paused;
  // owner/RBAC, workspace, payment authorization and booking eligibility remain mandatory.
  const results = await sql.transaction([
    sql`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
    sql`select pg_advisory_xact_lock(hashtextextended(${normalizedBookingId}::text, 62004))`,
    sql`
      with eligible as (
        select b.id, b.workspace_id, b.customer_id
        from bookings b
        join workspaces w on w.id::text = b.workspace_id
        join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
        where b.workspace_id = ${access.workspaceId}
          and (${process.env.VERCEL_ENV !== "preview"}::boolean or lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))=${approvedRecipient ?? ""})
          and w.slug = 'makeup-by-maria'
          and w.status in ('active', 'trial')
          and b.id = ${normalizedBookingId}::uuid
          and b.customer_id is not null
          and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
          and (${state} = 'unverified' or b.status in ('confirmed', 'completed'))
        for share of b
      ),
      latest as (
        select e.metadata->>'state' as state
        from customer_events e
        where e.workspace_id = ${access.workspaceId}
          and e.booking_id = ${normalizedBookingId}::uuid
          and e.event_type = 'note'
          and e.metadata->>'source' = ${source}
          and e.metadata->>'state' in ('paid', 'unverified')
        order by e.created_at desc, e.id desc
        limit 1
      ),
      inserted as (
        insert into customer_events (
          workspace_id, customer_id, booking_id, event_type, title, description, metadata
        )
        select eligible.workspace_id, eligible.customer_id, eligible.id,
          'note', ${title}, ${description},
          jsonb_build_object(
            'source', ${source}::text,
            'state', ${state}::text,
            'currency', 'SEK',
            'amount_minor', ${MARIA_DEPOSIT_AMOUNT_SEK * 100}::integer,
            'booking_number', coalesce(
              (select ref.reference from maria_booking_references ref
               where ref.booking_id=eligible.id),
              ${mariaBookingNumber(normalizedBookingId)}::text),
            'actor_user_id', ${access.userId}::text
          )
        from eligible
        where coalesce((select state from latest), 'unverified') <> ${state}
        returning id
      )
      select (select count(*)::int from eligible) as eligible_count,
        (select count(*)::int from inserted) as inserted_count
    `,
  ]);
  const row = results[2]?.[0];
  if (Number(row?.eligible_count ?? 0) !== 1) throw new Error("MARIA_MANUAL_SWISH_INELIGIBLE");
  return { changed: Number(row?.inserted_count ?? 0) === 1 };
}
