import "server-only";

import { neon } from "@neondatabase/serverless";

import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { verifyCustomerCalendarToken } from "@/lib/customer-calendar";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING;

export type RescheduleBookingData = {
  id: string;
  service: string;
  status: string;
  startsAt: string;
  endsAt: string;
  staffId: string | null;
  staffName: string | null;
  timeZone: string;
};

export async function getRescheduleBooking(token: string, bookingId: string): Promise<RescheduleBookingData | null> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const sql = neon(connectionString);
  const rows = await sql`
    select b.id, b.service, b.status, b.starts_at, b.ends_at, b.staff_id,
      s.name as staff_name, coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from bookings b
    left join workspace_staff s on s.id = b.staff_id and s.workspace_id = b.workspace_id
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    where b.id = ${bookingId} and b.customer_id = ${payload.customerId} and b.workspace_id = ${payload.workspaceId}
      and b.status in ('requested', 'confirmed') and b.starts_at > now()
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id), service: String(row.service ?? "Bokning"), status: String(row.status),
    startsAt: new Date(String(row.starts_at)).toISOString(), endsAt: new Date(String(row.ends_at)).toISOString(),
    staffId: row.staff_id ? String(row.staff_id) : null, staffName: row.staff_name ? String(row.staff_name) : null,
    timeZone: String(row.time_zone),
  };
}

export async function rescheduleCustomerBooking(token: string, bookingId: string, startsAtLocal: string) {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !/^[0-9a-f-]{36}$/i.test(bookingId)) return { ok: false as const, error: "invalid" };
  const localStart = parseLocalDateTime(startsAtLocal);
  if (!localStart) return { ok: false as const, error: "time" };

  const sql = neon(connectionString);
  const rows = await sql`
    select b.id, b.service, b.staff_id, coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone,
      sv.duration_minutes, sv.buffer_before_minutes, sv.buffer_after_minutes, sv.minimum_notice_minutes, sv.maximum_advance_days
    from bookings b
    join workspace_services sv on sv.workspace_id = b.workspace_id and sv.name = b.service and sv.is_active = true
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    where b.id = ${bookingId} and b.customer_id = ${payload.customerId} and b.workspace_id = ${payload.workspaceId}
      and b.status in ('requested', 'confirmed') and b.starts_at > now()
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  const booking = rows[0];
  if (!booking) return { ok: false as const, error: "not_allowed" };

  const weekday = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day)).getUTCDay();
  let hours: Record<string, unknown> | undefined;
  if (booking.staff_id) {
    const schedule = await sql`
      select start_time::text as opens_at, end_time::text as closes_at, false as is_closed
      from workspace_staff_schedules
      where workspace_id = ${payload.workspaceId} and staff_id = ${String(booking.staff_id)}::uuid
        and weekday = ${weekday} and is_active = true limit 1
    `;
    hours = schedule[0];
  } else {
    const published = await sql`
      select opens_at::text as opens_at, closes_at::text as closes_at, is_closed
      from workspace_booking_hours where workspace_id = ${payload.workspaceId} and weekday = ${weekday} limit 1
    `;
    hours = published[0];
  }

  const validation = validatePublicBookingPolicy({
    startsAt: startsAtLocal, now: new Date(),
    service: {
      durationMinutes: Math.max(1, Number(booking.duration_minutes) || 60),
      bufferBeforeMinutes: Math.max(0, Number(booking.buffer_before_minutes) || 0),
      bufferAfterMinutes: Math.max(0, Number(booking.buffer_after_minutes) || 0),
      minimumNoticeMinutes: Math.max(0, Number(booking.minimum_notice_minutes) || 0),
      maximumAdvanceDays: Math.max(1, Number(booking.maximum_advance_days) || 365),
    },
    bookingHour: hours ? { opensAt: String(hours.opens_at).slice(0, 5), closesAt: String(hours.closes_at).slice(0, 5), isClosed: Boolean(hours.is_closed) } : null,
    timeZone: resolveBookingTimeZone(booking.time_zone),
  });
  if (validation.error) return { ok: false as const, error: validation.error };
  const { start, end } = validation;

  if (booking.staff_id) {
    const timeOff = await sql`
      select id from workspace_staff_time_off
      where workspace_id = ${payload.workspaceId} and staff_id = ${String(booking.staff_id)}::uuid
        and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz limit 1
    `;
    if (timeOff[0]) return { ok: false as const, error: "time_off" };
  }

  const staffId = booking.staff_id ? String(booking.staff_id) : null;
  const conflict = await sql`
    select id from bookings
    where workspace_id = ${payload.workspaceId} and id <> ${bookingId} and status not in ('cancelled', 'no_show')
      and (${staffId}::uuid is null or staff_id = ${staffId}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    union all
    select id from public_booking_verifications
    where workspace_id = ${payload.workspaceId}::uuid and consumed_at is null and expires_at > now()
      and (${staffId}::uuid is null or staff_id = ${staffId}::uuid or staff_id is null)
      and starts_at < ${end.toISOString()}::timestamptz and ends_at > ${start.toISOString()}::timestamptz
    limit 1
  `;
  if (conflict[0]) return { ok: false as const, error: "conflict" };

  const updated = await sql`
    update bookings set starts_at = ${start.toISOString()}::timestamptz, ends_at = ${end.toISOString()}::timestamptz,
      status = 'requested', updated_at = now()
    where id = ${bookingId} and customer_id = ${payload.customerId} and workspace_id = ${payload.workspaceId}
      and status in ('requested', 'confirmed') and starts_at > now()
    returning id
  `;
  return updated[0] ? { ok: true as const } : { ok: false as const, error: "not_allowed" };
}
