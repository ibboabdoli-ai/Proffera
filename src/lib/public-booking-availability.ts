import {
  isValidLocalTime,
  localDateTimeParts,
  localDateTimeToUtc,
  parseLocalDateTime,
  resolveBookingTimeZone,
} from "./public-booking-policy";
import type { WorkspaceTimeZone } from "./workspace-market";

export type BookingAvailabilityService = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
};

export type BookingAvailabilityHour = {
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export type BookingAvailabilityBusyBooking = {
  startsAt: string;
  endsAt: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export function dateInputInTimeZone(date: Date, timeZone: WorkspaceTimeZone) {
  const values = localDateTimeParts(date, timeZone);
  return `${values.year}-${String(values.month).padStart(2, "0")}-${String(values.day).padStart(2, "0")}`;
}

export function localTimeToUtc(dateValue: string, timeValue: string, timeZone: WorkspaceTimeZone) {
  const local = parseLocalDateTime(`${dateValue}T${timeValue}`);
  if (!local) return new Date(Number.NaN);

  const result = localDateTimeToUtc(local, timeZone);
  return isValidLocalTime(local, result, timeZone) ? result : new Date(Number.NaN);
}

// Compatibility exports for existing Swedish booking callers.
export function stockholmDateInput(date: Date) {
  return dateInputInTimeZone(date, "Europe/Stockholm");
}

export function stockholmLocalToUtc(dateValue: string, timeValue: string) {
  return localTimeToUtc(dateValue, timeValue, "Europe/Stockholm");
}

export function addDaysToDateInput(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function getAvailableBookingTimes(input: {
  date: string;
  service: BookingAvailabilityService;
  hours: BookingAvailabilityHour;
  busyBookings: BookingAvailabilityBusyBooking[];
  referenceTimeMs: number;
  slotStepMinutes?: number;
  timeZone?: unknown;
}) {
  const { date, service, hours, busyBookings, referenceTimeMs, slotStepMinutes = 30 } = input;
  const timeZone = resolveBookingTimeZone(input.timeZone);
  if (!date || hours.isClosed) return [];

  const opensAt = toMinutes(hours.opensAt);
  const closesAt = toMinutes(hours.closesAt);
  const minimumStart = referenceTimeMs + service.minimumNoticeMinutes * 60_000;
  const maximumStart = referenceTimeMs + service.maximumAdvanceDays * 86_400_000;
  const slots: string[] = [];

  for (let start = opensAt; start + service.durationMinutes <= closesAt; start += slotStepMinutes) {
    const timeValue = toTime(start);
    const slotStart = localTimeToUtc(date, timeValue, timeZone).getTime();
    if (!Number.isFinite(slotStart) || slotStart < minimumStart || slotStart > maximumStart) continue;

    const slotEnd = slotStart + service.durationMinutes * 60_000;
    const protectedStart = slotStart - service.bufferBeforeMinutes * 60_000;
    const protectedEnd = slotEnd + service.bufferAfterMinutes * 60_000;
    const overlaps = busyBookings.some((booking) => {
      const bookingStart = new Date(booking.startsAt).getTime() - booking.bufferBeforeMinutes * 60_000;
      const bookingEnd = new Date(booking.endsAt).getTime() + booking.bufferAfterMinutes * 60_000;
      return bookingStart < protectedEnd && bookingEnd > protectedStart;
    });

    if (!overlaps) slots.push(timeValue);
  }

  return slots;
}
