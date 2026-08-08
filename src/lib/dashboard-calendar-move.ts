import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime, resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

export type CalendarMoveErrorCode =
  | "time"
  | "past"
  | "status"
  | "conflict"
  | "staff"
  | "staff_conflict"
  | "staff_hours"
  | "staff_time_off";

export class CalendarMoveValidationError extends Error {
  constructor(public readonly code: CalendarMoveErrorCode) {
    super(code);
    this.name = "CalendarMoveValidationError";
  }
}

export type CalendarMoveResult = {
  workspaceName: string;
  timeZone: ReturnType<typeof resolveBookingTimeZone>;
  notification: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    service: string;
    city: string;
    previousStartsAt: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

export async function moveDashboardCalendarBooking(input: {
  bookingId: string;
  localStartsAt: string;
  staffId: string;
}): Promise<CalendarMoveResult> {
  if (!connectionString) throw new Error("Missing database connection for calendar move");

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("Owner or admin workspace access is required");
  }

  const sql = neon(connectionString);
  const marketRows = await sql`
    select time_zone
    from workspace_settings
    where workspace_id = ${access.workspaceId}
    limit 1
  `;
  const timeZone = resolveBookingTimeZone(marketRows[0]?.time_zone);
  const localStart = parseLocalDateTime(input.localStartsAt);
  if (!localStart) throw new CalendarMoveValidationError("time");
  const newStart = localDateTimeToUtc(localStart, timeZone);
  if (!isValidLocalTime(localStart, newStart, timeZone) || Number.isNaN(newStart.getTime())) {
    throw new CalendarMoveValidationError("time");
  }
  if (newStart <= new Date()) throw new CalendarMoveValidationError("past");

  const rows = await sql`
    select
      b.id,
      b.customer_id,
      b.status,
      b.service,
      b.city,
      b.starts_at,
      b.ends_at,
      b.staff_id,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone
    from bookings b
    left join customers c
      on c.id = b.customer_id
     and c.workspace_id = b.workspace_id
    where b.id = ${input.bookingId}
      and b.workspace_id = ${access.workspaceId}
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  const booking = rows[0];
  if (!booking) throw new Error("Booking not found");
  if (["cancelled", "no_show", "completed"].includes(String(booking.status))) {
    throw new CalendarMoveValidationError("status");
  }

  const oldStart = new Date(String(booking.starts_at));
  const oldEnd = new Date(String(booking.ends_at));
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new CalendarMoveValidationError("time");
  const newEnd = new Date(newStart.getTime() + durationMs);

  const globalConflict = await sql`
    select id
    from bookings
    where workspace_id = ${access.workspaceId}
      and id <> ${input.bookingId}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${newEnd.toISOString()}::timestamptz
      and ends_at > ${newStart.toISOString()}::timestamptz
      and source in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  if (globalConflict[0]) throw new CalendarMoveValidationError("conflict");

  const staffId = input.staffId.trim();
  if (staffId) {
    const staffRows = await sql`
      select id
      from workspace_staff
      where id = ${staffId}
        and workspace_id = ${access.workspaceId}
        and is_active = true
      limit 1
    `;
    if (!staffRows[0]) throw new CalendarMoveValidationError("staff");

    const availabilityRows = await sql`
      select
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${access.workspaceId}
            and ss.staff_id = ${staffId}::uuid
            and ss.is_active = true
        ) as has_schedule,
        exists(
          select 1 from workspace_staff_schedules ss
          where ss.workspace_id = ${access.workspaceId}
            and ss.staff_id = ${staffId}::uuid
            and ss.is_active = true
            and ss.weekday = extract(dow from (${newStart.toISOString()}::timestamptz at time zone ${timeZone}))::int
            and ss.start_time <= (${newStart.toISOString()}::timestamptz at time zone ${timeZone})::time
            and ss.end_time >= (${newEnd.toISOString()}::timestamptz at time zone ${timeZone})::time
            and (${newStart.toISOString()}::timestamptz at time zone ${timeZone})::date = (${newEnd.toISOString()}::timestamptz at time zone ${timeZone})::date
        ) as inside_schedule,
        exists(
          select 1 from workspace_staff_time_off t
          where t.workspace_id = ${access.workspaceId}
            and t.staff_id = ${staffId}::uuid
            and t.starts_at < ${newEnd.toISOString()}::timestamptz
            and t.ends_at > ${newStart.toISOString()}::timestamptz
        ) as has_time_off
    `;
    const availability = availabilityRows[0];
    if (Boolean(availability?.has_time_off)) throw new CalendarMoveValidationError("staff_time_off");
    if (Boolean(availability?.has_schedule) && !Boolean(availability?.inside_schedule)) {
      throw new CalendarMoveValidationError("staff_hours");
    }

    const staffConflict = await sql`
      select id
      from bookings
      where workspace_id = ${access.workspaceId}
        and staff_id = ${staffId}::uuid
        and id <> ${input.bookingId}
        and status not in ('cancelled', 'no_show')
        and starts_at < ${newEnd.toISOString()}::timestamptz
        and ends_at > ${newStart.toISOString()}::timestamptz
      limit 1
    `;
    if (staffConflict[0]) throw new CalendarMoveValidationError("staff_conflict");
  }

  const changed = oldStart.getTime() !== newStart.getTime() || String(booking.staff_id ?? "") !== staffId;
  if (!changed) return { workspaceName: access.workspaceName, timeZone, notification: null };

  const updated = await sql`
    update bookings
    set starts_at = ${newStart.toISOString()}::timestamptz,
        ends_at = ${newEnd.toISOString()}::timestamptz,
        staff_id = ${staffId || null}::uuid,
        updated_at = now()
    where id = ${input.bookingId}
      and workspace_id = ${access.workspaceId}
    returning id
  `;
  if (!updated[0]) throw new Error("Calendar move failed");

  await sql`
    insert into customer_events (
      workspace_id, customer_id, booking_id, event_type, title, description, metadata
    ) values (
      ${access.workspaceId},
      ${booking.customer_id ? String(booking.customer_id) : null},
      ${input.bookingId},
      'booking_rescheduled',
      'Bokning flyttad i kalender',
      'Bokningens tid eller tilldelade medarbetare ändrades i kalendern.',
      jsonb_build_object(
        'source', 'dashboard_calendar_drag_drop',
        'previous_starts_at', ${oldStart.toISOString()},
        'previous_ends_at', ${oldEnd.toISOString()},
        'starts_at', ${newStart.toISOString()},
        'ends_at', ${newEnd.toISOString()},
        'previous_staff_id', ${String(booking.staff_id ?? "")},
        'staff_id', ${staffId}
      )
    )
  `;

  return {
    workspaceName: access.workspaceName,
    timeZone,
    notification: {
      customerName: String(booking.customer_name ?? "Kund"),
      customerEmail: String(booking.customer_email ?? ""),
      customerPhone: String(booking.customer_phone ?? ""),
      service: String(booking.service ?? "Bokning"),
      city: String(booking.city ?? ""),
      previousStartsAt: oldStart.toISOString(),
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    },
  };
}
