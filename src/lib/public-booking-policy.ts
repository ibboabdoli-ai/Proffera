export type PublicBookingServicePolicy = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
};

export type PublicBookingHourPolicy = {
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export type PublicBookingPolicyError = "time" | "notice" | "advance" | "hours" | "hours_missing";

export type ParsedLocalDateTime = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

export function parseLocalDateTime(value: string): ParsedLocalDateTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match;
  const parts = [Number(year), Number(month), Number(day), Number(hours), Number(minutes)];
  if (parts.some((part) => !Number.isInteger(part))) return null;

  const [y, m, d, h, min] = parts;
  const candidate = new Date(Date.UTC(y, m - 1, d, h, min));
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59 ||
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== m - 1 ||
    candidate.getUTCDate() !== d
  ) {
    return null;
  }

  return { year: y, month: m, day: d, hours: h, minutes: min };
}

export function stockholmDateToUtc(parts: ParsedLocalDateTime) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const inStockholm = (date: Date) => {
    const formatted = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return Date.UTC(
      Number(formatted.year),
      Number(formatted.month) - 1,
      Number(formatted.day),
      Number(formatted.hour),
      Number(formatted.minute),
    );
  };

  let date = new Date(desired);
  date = new Date(desired - (inStockholm(date) - desired));
  return date;
}

export function timeToMinutes(value: unknown) {
  const [hours, minutes] = String(value ?? "").slice(0, 5).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export function validatePublicBookingPolicy(input: {
  startsAt: string;
  now: Date;
  service: PublicBookingServicePolicy;
  bookingHour?: PublicBookingHourPolicy | null;
}) {
  const { startsAt, now, service, bookingHour } = input;
  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) return { error: "time" as PublicBookingPolicyError };

  const start = stockholmDateToUtc(localStart);
  if (Number.isNaN(start.getTime()) || start <= now) return { error: "time" as PublicBookingPolicyError };

  if (start.getTime() < now.getTime() + service.minimumNoticeMinutes * 60_000) {
    return { error: "notice" as PublicBookingPolicyError };
  }

  if (start.getTime() > now.getTime() + service.maximumAdvanceDays * 86_400_000) {
    return { error: "advance" as PublicBookingPolicyError };
  }

  if (!bookingHour) return { error: "hours_missing" as PublicBookingPolicyError };

  const opensAt = timeToMinutes(bookingHour.opensAt);
  const closesAt = timeToMinutes(bookingHour.closesAt);
  const requestedStart = localStart.hours * 60 + localStart.minutes;
  if (
    bookingHour.isClosed ||
    opensAt === null ||
    closesAt === null ||
    requestedStart < opensAt ||
    requestedStart + service.durationMinutes > closesAt
  ) {
    return { error: "hours" as PublicBookingPolicyError };
  }

  return {
    error: null,
    localStart,
    start,
    end: new Date(start.getTime() + service.durationMinutes * 60_000),
  };
}
