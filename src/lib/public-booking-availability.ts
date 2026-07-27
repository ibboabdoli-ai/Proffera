import {
  isValidStockholmLocalTime,
  parseLocalDateTime,
  stockholmDateToUtc,
} from "./public-booking-policy";

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

const stockholmFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function stockholmDateInput(date: Date) {
  const values = Object.fromEntries(
    stockholmFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function stockholmLocalToUtc(dateValue: string, timeValue: string) {
  const local = parseLocalDateTime(`${dateValue}T${timeValue}`);
  if (!local) return new Date(Number.NaN);

  const result = stockholmDateToUtc(local);
  return isValidStockholmLocalTime(local, result) ? result : new Date(Number.NaN);
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
}) {
  const { date, service, hours, busyBookings, referenceTimeMs, slotStepMinutes = 30 } = input;
  if (!date || hours.isClosed) return [];

  const opensAt = toMinutes(hours.opensAt);
  const closesAt = toMinutes(hours.closesAt);
  const minimumStart = referenceTimeMs + service.minimumNoticeMinutes * 60_000;
  const maximumStart = referenceTimeMs + service.maximumAdvanceDays * 86_400_000;
  const slots: string[] = [];

  for (let start = opensAt; start + service.durationMinutes <= closesAt; start += slotStepMinutes) {
    const timeValue = toTime(start);
    const slotStart = stockholmLocalToUtc(date, timeValue).getTime();
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
