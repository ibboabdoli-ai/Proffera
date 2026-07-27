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

const stockholmFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function stockholmParts(date: Date): ParsedLocalDateTime {
  const formatted = Object.fromEntries(
    stockholmFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(formatted.year),
    month: Number(formatted.month),
    day: Number(formatted.day),
    hours: Number(formatted.hour),
    minutes: Number(formatted.minute),
  };
}

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
  const inStockholm = (date: Date) => {
    const formatted = stockholmParts(date);
    return Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      formatted.hours,
      formatted.minutes,
    );
  };

  const probes = [
    new Date(desired - 86_400_000),
    new Date(desired),
    new Date(desired + 86_400_000),
  ];
  const offsets = [...new Set(probes.map((probe) => inStockholm(probe) - probe.getTime()))];
  const candidates = offsets.map((offset) => new Date(desired - offset));
  return candidates.find((candidate) => isValidStockholmLocalTime(parts, candidate))
    ?? candidates[0]
    ?? new Date(Number.NaN);
}

export function isValidStockholmLocalTime(parts: ParsedLocalDateTime, date = stockholmDateToUtc(parts)) {
  const roundTrip = stockholmParts(date);
  return (
    roundTrip.year === parts.year &&
    roundTrip.month === parts.month &&
    roundTrip.day === parts.day &&
    roundTrip.hours === parts.hours &&
    roundTrip.minutes === parts.minutes
  );
}

export function timeToMinutes(value: unknown) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? "").trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
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
  if (!isValidStockholmLocalTime(localStart, start) || Number.isNaN(start.getTime()) || start <= now) {
    return { error: "time" as PublicBookingPolicyError };
  }

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
