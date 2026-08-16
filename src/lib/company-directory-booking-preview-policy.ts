import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  localTimeToUtc,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

export type BookingPreviewHour = BookingAvailabilityHour & { weekday: number };

export type BookingPreviewStaff = {
  schedules: BookingPreviewHour[];
  busy: BookingAvailabilityBusyBooking[];
};

export type NextAvailableBookingPreview = {
  date: string;
  time: string;
  startsAt: string;
  timeZone: WorkspaceTimeZone;
};

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function earliestStaffSlot(input: {
  date: string;
  service: BookingAvailabilityService;
  staff: BookingPreviewStaff[];
  referenceTimeMs: number;
  timeZone: WorkspaceTimeZone;
}) {
  let earliest: string | null = null;

  for (const member of input.staff) {
    const hours = member.schedules.find((item) => item.weekday === weekdayForDate(input.date));
    if (!hours) continue;
    const slot = getAvailableBookingTimes({
      date: input.date,
      service: input.service,
      hours,
      busyBookings: member.busy,
      referenceTimeMs: input.referenceTimeMs,
      timeZone: input.timeZone,
    })[0];
    if (slot && (!earliest || slot < earliest)) earliest = slot;
  }

  return earliest;
}

export function findNextAvailableBookingPreview(input: {
  service: BookingAvailabilityService;
  bookingHours: BookingPreviewHour[];
  busyBookings: BookingAvailabilityBusyBooking[];
  staff: BookingPreviewStaff[];
  referenceTimeMs: number;
  timeZone: WorkspaceTimeZone;
  horizonDays?: number;
}): NextAvailableBookingPreview | null {
  const today = dateInputInTimeZone(new Date(input.referenceTimeMs), input.timeZone);
  const horizonDays = Math.max(0, Math.min(input.service.maximumAdvanceDays, input.horizonDays ?? 28));

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const date = addDaysToDateInput(today, offset);
    let time: string | null = null;

    if (input.staff.length > 0) {
      time = earliestStaffSlot({
        date,
        service: input.service,
        staff: input.staff,
        referenceTimeMs: input.referenceTimeMs,
        timeZone: input.timeZone,
      });
    } else {
      const hours = input.bookingHours.find((item) => item.weekday === weekdayForDate(date));
      if (hours) {
        time = getAvailableBookingTimes({
          date,
          service: input.service,
          hours,
          busyBookings: input.busyBookings,
          referenceTimeMs: input.referenceTimeMs,
          timeZone: input.timeZone,
        })[0] ?? null;
      }
    }

    if (!time) continue;
    const startsAt = localTimeToUtc(date, time, input.timeZone);
    if (!Number.isFinite(startsAt.getTime())) continue;

    return {
      date,
      time,
      startsAt: startsAt.toISOString(),
      timeZone: input.timeZone,
    };
  }

  return null;
}
