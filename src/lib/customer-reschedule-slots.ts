import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { parseLocalDateTime, resolveBookingTimeZone, validatePublicBookingPolicy } from "@/lib/public-booking-policy";
import { verifyCustomerCalendarToken } from "@/lib/customer-calendar";

const connectionString = resolveDatabaseUrl()_NON_POOLING;

export type RescheduleDay = { date: string; label: string; shortLabel: string };
export type RescheduleSlot = { startsAtLocal: string; label: string };

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function addCalendarDays(input: { year: number; month: number; day: number }, amount: number) {
  const date = new Date(Date.UTC(input.year, input.month - 1, input.day + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function toDateKey(input: { year: number; month: number; day: number }) {
  return `${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}`;
}

export function getUpcomingRescheduleDays(timeZone: string, count = 7): RescheduleDay[] {
  const today = localDateParts(new Date(), timeZone);
  return Array.from({ length: count }, (_, index) => {
    const parts = addCalendarDays(today, index);
    const date = toDateKey(parts);
    const displayDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
    return {
      date,
      label: new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(displayDate),
      shortLabel: new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(displayDate),
    };
  });
}

export async function getAvailableRescheduleSlots(token: string, bookingId: string, selectedDate: string): Promise<RescheduleSlot[]> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !/^[0-9a-f-]{36}$/i.test(bookingId) || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return [];

  const sql = neon(connectionString);
  const rows = await sql`
    select b.id, b.service, b.staff_id,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone,
      sv.duration_minutes, sv.buffer_before_minutes, sv.buffer_after_minutes,
      sv.minimum_notice_minutes, sv.maximum_advance_days
    from bookings b
    join workspace_services sv on sv.workspace_id = b.workspace_id and sv.name = b.service and sv.is_active = true
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    where b.id = ${bookingId}
      and b.customer_id = ${payload.customerId}
      and b.workspace_id = ${payload.workspaceId}
      and b.status in ('requested', 'confirmed')
      and b.starts_at > now()
    limit 1
  `;
  const booking = rows[0];
  if (!booking) return [];

  const parsedDate = parseLocalDateTime(`${selectedDate}T12:00`);
  if (!parsedDate) return [];
  const weekday = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay();

  const hoursRows = booking.staff_id
    ? await sql`select start_time::text as opens_at, end_time::text as closes_at, false as is_closed from workspace_staff_schedules where workspace_id = ${payload.workspaceId} and staff_id = ${String(booking.staff_id)}::uuid and weekday = ${weekday} and is_active = true limit 1`
    : await sql`select opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id = ${payload.workspaceId} and weekday = ${weekday} limit 1`;
  const hours = hoursRows[0];
  if (!hours || Boolean(hours.is_closed)) return [];

  const opensAt = String(hours.opens_at).slice(0, 5);
  const closesAt = String(hours.closes_at).slice(0, 5);
  const [openHour, openMinute] = opensAt.split(":").map(Number);
  const [closeHour, closeMinute] = closesAt.split(":").map(Number);
  if (![openHour, openMinute, closeHour, closeMinute].every(Number.isFinite)) return [];

  const timeZone = resolveBookingTimeZone(booking.time_zone);
  const service = {
    durationMinutes: Math.max(1, Number(booking.duration_minutes) || 60),
    bufferBeforeMinutes: Math.max(0, Number(booking.buffer_before_minutes) || 0),
    bufferAfterMinutes: Math.max(0, Number(booking.buffer_after_minutes) || 0),
    minimumNoticeMinutes: Math.max(0, Number(booking.minimum_notice_minutes) || 0),
    maximumAdvanceDays: Math.max(1, Number(booking.maximum_advance_days) || 365),
  };

  const rangeStart = new Date(`${selectedDate}T00:00:00.000Z`);
  const rangeEnd = new Date(rangeStart.getTime() + 48 * 60 * 60 * 1000);
  const staffId = booking.staff_id ? String(booking.staff_id) : null;
  const [bookingConflicts, holds, timeOff] = await Promise.all([
    sql`select starts_at, ends_at from bookings where workspace_id = ${payload.workspaceId} and id <> ${bookingId} and status not in ('cancelled', 'no_show') and (${staffId}::uuid is null or staff_id = ${staffId}::uuid or staff_id is null) and starts_at < ${rangeEnd.toISOString()}::timestamptz and ends_at > ${rangeStart.toISOString()}::timestamptz`,
    sql`select starts_at, ends_at from public_booking_verifications where workspace_id = ${payload.workspaceId}::uuid and consumed_at is null and expires_at > now() and (${staffId}::uuid is null or staff_id = ${staffId}::uuid or staff_id is null) and starts_at < ${rangeEnd.toISOString()}::timestamptz and ends_at > ${rangeStart.toISOString()}::timestamptz`,
    staffId ? sql`select starts_at, ends_at from workspace_staff_time_off where workspace_id = ${payload.workspaceId} and staff_id = ${staffId}::uuid and starts_at < ${rangeEnd.toISOString()}::timestamptz and ends_at > ${rangeStart.toISOString()}::timestamptz` : Promise.resolve([]),
  ]);

  const intervals = [...bookingConflicts, ...holds, ...timeOff].map((row) => ({
    start: new Date(String(row.starts_at)).getTime(),
    end: new Date(String(row.ends_at)).getTime(),
  }));

  const openTotal = openHour * 60 + openMinute;
  const closeTotal = closeHour * 60 + closeMinute;
  const slots: RescheduleSlot[] = [];

  for (let minute = openTotal; minute < closeTotal; minute += 15) {
    const hour = Math.floor(minute / 60);
    const mins = minute % 60;
    const startsAtLocal = `${selectedDate}T${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const validation = validatePublicBookingPolicy({
      startsAt: startsAtLocal,
      now: new Date(),
      service,
      bookingHour: { opensAt, closesAt, isClosed: false },
      timeZone,
    });
    if (validation.error) continue;

    const startMs = validation.start.getTime();
    const endMs = validation.end.getTime();
    if (intervals.some((interval) => interval.start < endMs && interval.end > startMs)) continue;

    slots.push({ startsAtLocal, label: `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}` });
  }

  return slots;
}
