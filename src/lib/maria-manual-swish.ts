import "server-only";

import { getSql } from "@/lib/db/server";
import { MARIA_DEPOSIT_AMOUNT_SEK, mariaBookingNumber } from "@/lib/maria-deposit";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

const source = "maria_swish_manual_deposit_v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManualSwishState = "paid" | "unverified";
export type ManualSwishEntry = { state: ManualSwishState; markedAt: string };
export type ManualSwishStatusRead = {
  ok: boolean;
  entries: Record<string, ManualSwishEntry>;
};

async function requireMariaPreviewManager() {
  const access = await getUserWorkspaceAccess();
  if (process.env.VERCEL_ENV !== "preview"
    || !access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)
    || !(await hasDashboardModuleAccess("online_booking"))) {
    throw new Error("MARIA_MANUAL_SWISH_FORBIDDEN");
  }
  return access;
}

/** Dashboard only: a manual record, never a bank-confirmed payment. */
export async function readMariaManualSwishStatuses(): Promise<ManualSwishStatusRead> {
  try {
    const access = await requireMariaPreviewManager();
    const sql = getSql();
    if (!sql) return { ok: false, entries: {} };
    const rows = await sql`
      select b.id::text as booking_id,
        latest.metadata->>'state' as state,
        latest.created_at::text as marked_at
      from bookings b
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
  const access = await requireMariaPreviewManager();
  const sql = getSql();
  if (!sql) throw new Error("MARIA_MANUAL_SWISH_DATABASE");
  const title = state === "paid"
    ? "Swish-handpenning manuellt markerad som betald"
    : "Manuell Swish-betalningsmarkering ångrad";
  const description = state === "paid"
    ? "Administratören har kontrollerat Swish och markerat handpenning 2 000 kr som mottagen."
    : "Administratören har återställt betalningsstatus till ej verifierad.";
  // One transaction and one per-booking lock: concurrent clicks cannot create duplicate status events.
  const results = await sql.transaction([
    sql`select pg_advisory_xact_lock(hashtextextended(${bookingId}::text, 62004))`,
    sql`
      with eligible as (
        select b.id, b.workspace_id, b.customer_id
        from bookings b
        join workspaces w on w.id::text = b.workspace_id
        where b.workspace_id = ${access.workspaceId}
          and w.slug = 'makeup-by-maria'
          and w.status in ('active', 'trial')
          and b.id = ${bookingId}::uuid
          and b.customer_id is not null
          and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
          and (${state} = 'unverified' or b.status in ('confirmed', 'completed'))
      ),
      latest as (
        select e.metadata->>'state' as state
        from customer_events e
        where e.workspace_id = ${access.workspaceId}
          and e.booking_id = ${bookingId}::uuid
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
            'source', ${source},
            'state', ${state},
            'currency', 'SEK',
            'amount_minor', ${MARIA_DEPOSIT_AMOUNT_SEK * 100},
            'booking_number', ${mariaBookingNumber(bookingId)},
            'actor_user_id', ${access.userId}
          )
        from eligible
        where coalesce((select state from latest), 'unverified') <> ${state}
        returning id
      )
      select (select count(*)::int from eligible) as eligible_count,
        (select count(*)::int from inserted) as inserted_count
    `,
  ]);
  const row = results[1]?.[0];
  if (Number(row?.eligible_count ?? 0) !== 1) throw new Error("MARIA_MANUAL_SWISH_INELIGIBLE");
  return { changed: Number(row?.inserted_count ?? 0) === 1 };
}
