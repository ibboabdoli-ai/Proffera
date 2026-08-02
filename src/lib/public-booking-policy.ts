import { DEFAULT_WORKSPACE_MARKET, isWorkspaceTimeZone, type WorkspaceTimeZone } from "./workspace-market";

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

const formatters = new Map<WorkspaceTimeZone, Intl.DateTimeFormat>();

export function resolveBookingTimeZone(value: unknown): WorkspaceTimeZone {
  return isWorkspaceTimeZone(value) ? value : DEFAULT_WORKSPACE_MARKET.timeZone;
}

function getFormatter(timeZone: WorkspaceTimeZone) {
  const existing = formatters.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

export function localDateTimeParts(date: Date, timeZone: WorkspaceTimeZone = DEFAULT_WORKSPACE_MARKET.timeZone): ParsedLocalDateTime {
  const formatted = Object.fromEntries(
    getFormatter(timeZone)
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

export function localDateTimeToUtc(parts: ParsedLocalDateTime, timeZone: WorkspaceTimeZone = DEFAULT_WORKSPACE_MARKET.timeZone): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  const inTimeZone = (date: Date) => {
    const formatted = localDateTimeParts(date, timeZone);
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
  const offsets = [...new Set(probes.map((probe) => inTimeZone(probe) - probe.getTime()))];
  const candidates = offsets.map((offset) => new Date(desired - offset));
  return candidates.find((candidate) => isValidLocalTime(parts, candidate, timeZone))
    ?? candidates[0]
    ?? new Date(Number.NaN);
}

export function isValidLocalTime(
  parts: ParsedLocalDateTime,
  date: Date | undefined = undefined,
  timeZone: WorkspaceTimeZone = DEFAULT_WORKSPACE_MARKET.timeZone,
) {
  const roundTrip = localDateTimeParts(date ?? localDateTimeToUtc(parts, timeZone), timeZone);
  return (
    roundTrip.year === parts.year &&
    roundTrip.month === parts.month &&
    roundTrip.day === parts.day &&
    roundTrip.hours === parts.hours &&
    roundTrip.minutes === parts.minutes
  );
}

// Keep the previous exports while callers are migrated. Their behavior remains
// exactly Stockholm-based, which protects existing Swedish booking links.
export function stockholmDateToUtc(parts: ParsedLocalDateTime) {
  return localDateTimeToUtc(parts, "Europe/Stockholm");
}

export function isValidStockholmLocalTime(parts: ParsedLocalDateTime, date?: Date) {
  return isValidLocalTime(parts, date, "Europe/Stockholm");
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
  timeZone?: unknown;
}) {
  const { startsAt, now, service, bookingHour } = input;
  const timeZone = resolveBookingTimeZone(input.timeZone);
  const localStart = parseLocalDateTime(startsAt);
  if (!localStart) return { error: "time" as PublicBookingPolicyError };

  const start = localDateTimeToUtc(localStart, timeZone);
  if (!isValidLocalTime(localStart, start, timeZone) || Number.isNaN(start.getTime()) || start <= now) {
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
