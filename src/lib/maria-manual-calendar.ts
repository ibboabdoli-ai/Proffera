import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";
import {
  MARIA_CALENDAR_MARKER, MARIA_CALENDAR_TITLE,
  mariaCalendarDateAllowed, mariaCalendarDayBounds, mariaCalendarIntervals,
} from "@/lib/maria-manual-calendar-policy";

export type MariaCalendarSlot = {
  clock: string; endClock: string; startsAt: string; endsAt: string;
  manuallyClosed: boolean; appointmentCount: number; holdCount: number; otherBlock: boolean;
};

export type MariaCalendarAppointment = {
  id: string; customerName: string; title: string; status: string;
  startsAt: string; endsAt: string;
};

export type MariaCalendarView = {
  date: string; weeklyClosed: boolean; slots: MariaCalendarSlot[];
  appointments: MariaCalendarAppointment[]; holdCount: number; futureManualBlockCount: number;
  snapshotAtEpoch: number;
};

export class MariaCalendarError extends Error {
  constructor(public readonly code: "access" | "date" | "schedule" | "time" | "conflict" | "database") {
    super(code);
  }
}

async function requireMariaCalendarManager() {
  if (process.env.VERCEL_ENV !== "preview") throw new MariaCalendarError("access");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)
    || !(await hasDashboardModuleAccess("online_booking"))) throw new MariaCalendarError("access");
  const sql = getSql();
  if (!sql) throw new MariaCalendarError("database");
  return { sql, workspaceId: access.workspaceId, userId: access.userId };
}

async function loadCalendarHours(sql: NonNullable<ReturnType<typeof getSql>>, workspaceId: string, weekday: number) {
  const rows = await sql`
    select h.opens_at::text as opens_at,h.closes_at::text as closes_at,h.is_closed
    from workspace_booking_hours h
    join workspaces w on w.id::text=h.workspace_id
    where w.id=${workspaceId}::uuid and w.slug='makeup-by-maria'
      and w.status in ('active','trial') and h.weekday=${weekday}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new MariaCalendarError("schedule");
  return {
    first: String(row.opens_at ?? "").slice(0, 5),
    last: String(row.closes_at ?? "").slice(0, 5),
    weeklyClosed: Boolean(row.is_closed),
  };
}

export async function readMariaManualCalendar(date: string, now = new Date()): Promise<MariaCalendarView> {
  const { sql, workspaceId } = await requireMariaCalendarManager();
  if (!mariaCalendarDateAllowed(date, now)) throw new MariaCalendarError("date");
  const bounds = mariaCalendarDayBounds(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!bounds) throw new MariaCalendarError("date");
  try {
    const [hours, bookedRows, holdRows] = await Promise.all([
      loadCalendarHours(sql, workspaceId, day),
      sql`
        select b.id::text as id,b.title,b.status,b.source,b.notes,
          b.starts_at::text as starts_at,b.ends_at::text as ends_at,
          coalesce(c.name,'') as customer_name
        from bookings b
        left join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
        where b.workspace_id=${workspaceId}
          and b.status not in ('cancelled','no_show')
          and b.starts_at < ${bounds.endsAt}::timestamptz
          and b.ends_at > ${bounds.startsAt}::timestamptz
        order by b.starts_at asc
        limit 300
      `,
      sql`
        select (v.starts_at-(coalesce(s.buffer_before_minutes,0)*interval '1 minute'))::text as starts_at,
          (v.ends_at+(coalesce(s.buffer_after_minutes,0)*interval '1 minute'))::text as ends_at
        from public_booking_verifications v
        left join workspace_services s on s.id=v.service_id and s.workspace_id=v.workspace_id::text
        where v.workspace_id=${workspaceId}::uuid
          and v.consumed_at is null and v.expires_at>now()
          and v.starts_at-(coalesce(s.buffer_before_minutes,0)*interval '1 minute') < ${bounds.endsAt}::timestamptz
          and v.ends_at+(coalesce(s.buffer_after_minutes,0)*interval '1 minute') > ${bounds.startsAt}::timestamptz
        order by v.starts_at asc
        limit 300
      `,
    ]);
    // Never present a partial occupancy picture as if it were complete.
    if (bookedRows.length >= 300 || holdRows.length >= 300) throw new MariaCalendarError("database");
    // Reopening day-long blocks must stay possible even if the current
    // working-hours grid is invalid or no longer includes old blocks.
    const base = (hours.weeklyClosed ? [] : mariaCalendarIntervals(date, hours.first, hours.last)) ?? [];
    const bookings = bookedRows.map(row => ({
      id: String(row.id), title: String(row.title ?? ""), status: String(row.status ?? ""),
      source: String(row.source ?? ""), notes: String(row.notes ?? ""),
      customerName: String(row.customer_name ?? ""),
      start: Date.parse(String(row.starts_at)), end: Date.parse(String(row.ends_at)),
    }));
    const holds = holdRows.map(row => ({
      start: Date.parse(String(row.starts_at)), end: Date.parse(String(row.ends_at)),
    }));
    const isManual = (b: typeof bookings[number]) =>
      b.source === "dashboard_availability_block" && b.notes === MARIA_CALENDAR_MARKER;
    const overlaps = (start: number, end: number, slotStart: number, slotEnd: number) =>
      Number.isFinite(start) && Number.isFinite(end) && start < slotEnd && end > slotStart;
    const slots: MariaCalendarSlot[] = base.map(slot => {
      const start = Date.parse(slot.startsAt), end = Date.parse(slot.endsAt);
      return {
        ...slot,
        manuallyClosed: bookings.some(b => isManual(b) && b.start === start && b.end === end),
        appointmentCount: bookings.filter(b =>
          !b.source.startsWith("dashboard_availability_")
          && overlaps(b.start,b.end,start,end)).length,
        otherBlock: bookings.some(b =>
          b.source.startsWith("dashboard_availability_") && !isManual(b)
          && overlaps(b.start,b.end,start,end)),
        holdCount: holds.filter(h => overlaps(h.start,h.end,start,end)).length,
      };
    });
    const appointments: MariaCalendarAppointment[] = bookings
      .filter(b => !b.source.startsWith("dashboard_availability_")
        && b.start >= Date.parse(bounds.startsAt) && b.start < Date.parse(bounds.endsAt))
      .map(b => ({
        id:b.id,customerName:b.customerName,title:b.title,status:b.status,
        startsAt:new Date(b.start).toISOString(),endsAt:new Date(b.end).toISOString(),
      }));
    const futureManualBlockCount = bookings.filter(b => isManual(b) && b.start > now.getTime()).length;
    return { date, weeklyClosed: hours.weeklyClosed, slots, appointments,
      holdCount: holds.length, futureManualBlockCount, snapshotAtEpoch: now.getTime() };
  } catch (error) {
    if (error instanceof MariaCalendarError) throw error;
    console.error("Maria calendar read failed", error);
    throw new MariaCalendarError("database");
  }
}

type CalendarChange = { date: string; mode: "close" | "open" | "close_day" | "open_day"; clock?: string };

export async function changeMariaManualCalendar(input: CalendarChange, now = new Date()) {
  const { sql, workspaceId, userId } = await requireMariaCalendarManager();
  if (!mariaCalendarDateAllowed(input.date, now)) throw new MariaCalendarError("date");
  const bounds = mariaCalendarDayBounds(input.date);
  const day = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  if (!bounds) throw new MariaCalendarError("date");
  const hours = await loadCalendarHours(sql, workspaceId, day);
  if (input.mode !== "open_day" && hours.weeklyClosed) throw new MariaCalendarError("schedule");
  const intervals = hours.weeklyClosed ? [] : mariaCalendarIntervals(input.date, hours.first, hours.last);
  if (intervals === null && input.mode !== "open_day") throw new MariaCalendarError("schedule");
  if (!["close","open","close_day","open_day"].includes(input.mode)) throw new MariaCalendarError("time");
  const single = input.mode === "close" || input.mode === "open";
  const availableIntervals = intervals ?? [];
  const requested = single ? availableIntervals.filter(i => i.clock === input.clock) : availableIntervals;
  if (single && requested.length !== 1) throw new MariaCalendarError("time");
  const future = requested.filter(i => Date.parse(i.startsAt) > now.getTime());
  if (single && future.length !== 1) throw new MariaCalendarError("time");
  if (input.mode === "close_day" && !future.length) throw new MariaCalendarError("time");

  const audit = JSON.stringify({
    date: input.date, mode: input.mode, clock: single ? input.clock : null,
    requestedIntervals: future.length, previewOnly: true,
  });
  try {
    const rows = await sql.transaction([
      // Same workspace-wide lock as Maria verification, dashboard status and rescheduling.
      sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}::text,713))`,
      // A concurrent manager schedule edit invalidates our preflight instead of
      // silently blocking times under a now-different working schedule.
      sql`
        select 1/(case when exists (
          select 1 from workspace_booking_hours h
          join workspaces w on w.id::text=h.workspace_id
          where w.id=${workspaceId}::uuid and w.slug='makeup-by-maria'
            and w.status in ('active','trial') and h.weekday=${day}
            and h.is_closed=${hours.weeklyClosed}
            and h.opens_at is not distinct from ${hours.first || null}::time
            and h.closes_at is not distinct from ${hours.last || null}::time
        ) then 1 else 0 end) as calendar_schedule_guard
      `,
      // An unexpired OTP hold takes priority. A manual block may overlap an
      // existing requested/confirmed booking, but must never invalidate a code
      // the customer is still allowed to verify. This is evaluated AFTER the
      // shared advisory lock, so hold creation/finalization cannot race it.
      ...((input.mode === "close" || input.mode === "close_day") ? [sql`
        select 1/(case when not exists(
          select 1 from public_booking_verifications hold
          left join workspace_services service
            on service.id=hold.service_id and service.workspace_id=hold.workspace_id::text
          where hold.workspace_id=${workspaceId}::uuid
            and hold.consumed_at is null and hold.expires_at>now()
            and hold.starts_at-(coalesce(service.buffer_before_minutes,0)*interval '1 minute')
              < ${future.at(-1)!.endsAt}::timestamptz
            and hold.ends_at+(coalesce(service.buffer_after_minutes,0)*interval '1 minute')
              > ${future[0]!.startsAt}::timestamptz
        ) then 1 else 0 end) as calendar_hold_guard
      `] : []),
      ...(input.mode === "open_day"
        ? [sql`
          delete from bookings b
          where b.workspace_id=${workspaceId}
            and b.source='dashboard_availability_block'
            and b.notes=${MARIA_CALENDAR_MARKER}
            and b.customer_id is null and b.status='confirmed'
            and b.starts_at >= ${bounds.startsAt}::timestamptz
            and b.starts_at < ${bounds.endsAt}::timestamptz
            and b.ends_at <= ${bounds.endsAt}::timestamptz
            and b.starts_at>clock_timestamp()
          returning b.id
        `]
        : future.map(slot => input.mode === "open"
          ? sql`
              delete from bookings b
              where b.workspace_id=${workspaceId}
                and b.source='dashboard_availability_block'
                and b.notes=${MARIA_CALENDAR_MARKER}
                and b.customer_id is null and b.status='confirmed'
                and b.starts_at=${slot.startsAt}::timestamptz
                and b.ends_at=${slot.endsAt}::timestamptz
                and b.starts_at>clock_timestamp()
              returning b.id
            `
          : sql`
              insert into bookings(
                workspace_id,customer_id,title,service,city,status,starts_at,ends_at,source,notes
              )
              select ${workspaceId},null,${MARIA_CALENDAR_TITLE},'Blockerad tid',null,
                'confirmed',${slot.startsAt}::timestamptz,${slot.endsAt}::timestamptz,
                'dashboard_availability_block',${MARIA_CALENDAR_MARKER}
              where exists(
                select 1 from workspaces w
                where w.id=${workspaceId}::uuid and w.slug='makeup-by-maria'
                  and w.status in ('active','trial')
              ) and clock_timestamp() < ${slot.startsAt}::timestamptz
                and not exists(
                select 1 from bookings b
                where b.workspace_id=${workspaceId}
                  and b.source='dashboard_availability_block'
                  and b.notes=${MARIA_CALENDAR_MARKER}
                  and b.status='confirmed'
                  and b.starts_at=${slot.startsAt}::timestamptz
                  and b.ends_at=${slot.endsAt}::timestamptz
              )
              returning id
            `)),
      sql`
        insert into admin_audit_logs(admin_user_id,workspace_id,action,reason,new_value)
        values(${userId},${workspaceId}::uuid,
          'maria.manual_calendar.updated',
          'Preview-only manual interval availability change',
          ${audit}::jsonb)
      `,
    ]);
    const guardCount = (input.mode === "close" || input.mode === "close_day") ? 3 : 2;
    const effects = rows.slice(guardCount,-1).reduce((count, result) => count + result.length,0);
    return { changed: effects > 0, affectedIntervals: effects };
  } catch (error) {
    // SQLSTATE 22012 is an atomic assertion failure: schedule changed, or
    // a verification hold overlaps the requested closure. No writes committed.
    if ((error as {code?: string} | null)?.code === "22012") {
      throw new MariaCalendarError("conflict");
    }
    console.error("Maria calendar mutation failed closed",error);
    throw new MariaCalendarError("database");
  }
}
