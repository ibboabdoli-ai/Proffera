import "server-only";

import { neon } from "@neondatabase/serverless";

import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime, resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export class BookingRescheduleValidationError extends Error {
  constructor(public readonly code: "time" | "past" | "conflict" | "status") {
    super(code);
    this.name = "BookingRescheduleValidationError";
  }
}

export type BookingRescheduleResult = {
  changed: boolean;
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

export async function rescheduleDashboardBooking(
  bookingId: string,
  localStartsAt: string,
): Promise<BookingRescheduleResult> {
  if (!connectionString) {
    throw new Error("Missing database connection for dashboard booking reschedule");
  }

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for booking updates");
  }

  const sql = neon(connectionString);
  const marketRows = await sql`
    select time_zone
    from workspace_settings
    where workspace_id = ${access.workspaceId}
    limit 1
  `;
  const timeZone = resolveBookingTimeZone(marketRows[0]?.time_zone);
  const localStart = parseLocalDateTime(localStartsAt);
  if (!localStart) throw new BookingRescheduleValidationError("time");

  const newStart = localDateTimeToUtc(localStart, timeZone);
  if (!isValidLocalTime(localStart, newStart, timeZone) || Number.isNaN(newStart.getTime())) {
    throw new BookingRescheduleValidationError("time");
  }
  if (newStart <= new Date()) throw new BookingRescheduleValidationError("past");

  const existingRows = await sql`
    select
      b.id,
      b.workspace_id,
      b.customer_id,
      b.staff_id,
      b.status,
      b.service,
      b.city,
      b.starts_at,
      b.ends_at,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone
    from bookings b
    left join customers c on c.id = b.customer_id
    where b.workspace_id = ${access.workspaceId}
      and b.id = ${bookingId}
    limit 1
  `;

  const existing = existingRows[0];
  if (!existing) throw new Error("Booking reschedule did not match a booking");
  if (String(existing.status) === "cancelled" || String(existing.status) === "no_show") {
    throw new BookingRescheduleValidationError("status");
  }

  const oldStart = new Date(String(existing.starts_at));
  const oldEnd = new Date(String(existing.ends_at));
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new BookingRescheduleValidationError("time");
  }
  const newEnd = new Date(newStart.getTime() + durationMs);

  const conflicts = await sql`
    select id
    from bookings
    where workspace_id = ${access.workspaceId}
      and id <> ${bookingId}
      and status not in ('cancelled', 'no_show')
      and starts_at is not null
      and ends_at is not null
      and starts_at < ${newEnd.toISOString()}::timestamptz
      and ends_at > ${newStart.toISOString()}::timestamptz
    limit 1
  `;
  if (conflicts[0]) throw new BookingRescheduleValidationError("conflict");

  if (existing.staff_id && String(existing.workspace_id) === access.workspaceId) {
    const staffId = String(existing.staff_id);
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
    if (Boolean(availability?.has_time_off) || (Boolean(availability?.has_schedule) && !Boolean(availability?.inside_schedule))) {
      throw new BookingRescheduleValidationError("conflict");
    }
  }

  const changed = oldStart.getTime() !== newStart.getTime();
  if (!changed) return { changed: false, timeZone, notification: null };

  await sql`
    update bookings
    set starts_at = ${newStart.toISOString()}::timestamptz,
        ends_at = ${newEnd.toISOString()}::timestamptz,
        updated_at = now()
    where workspace_id = ${access.workspaceId}
      and id = ${bookingId}
  `;

  await sql`
    insert into customer_events (
      workspace_id,
      customer_id,
      booking_id,
      event_type,
      title,
      description,
      metadata
    )
    values (
      ${String(existing.workspace_id)},
      ${existing.customer_id ? String(existing.customer_id) : null},
      ${bookingId},
      'booking_rescheduled',
      'Bokning ombokad',
      'Bokningens tid ändrades.',
      jsonb_build_object(
        'source', 'dashboard_manual',
        'previous_starts_at', ${oldStart.toISOString()},
        'previous_ends_at', ${oldEnd.toISOString()},
        'starts_at', ${newStart.toISOString()},
        'ends_at', ${newEnd.toISOString()}
      )
    )
  `;

  return {
    changed: true,
    timeZone,
    notification: {
      customerName: String(existing.customer_name ?? "Kund"),
      customerEmail: String(existing.customer_email ?? ""),
      customerPhone: String(existing.customer_phone ?? ""),
      service: String(existing.service ?? "Bokning"),
      city: String(existing.city ?? ""),
      previousStartsAt: oldStart.toISOString(),
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    },
  };
}
