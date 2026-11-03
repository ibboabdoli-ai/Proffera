import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime } from "@/lib/public-booking-policy";

export const MARIA_CALENDAR_MARKER = "maria_manual_calendar_v1";
export const MARIA_CALENDAR_TITLE = "Manuellt stängd tid";
export const MARIA_CALENDAR_ZONE = "Europe/Stockholm" as const;

export type MariaCalendarInterval = {
  clock: string;
  endClock: string;
  startsAt: string;
  endsAt: string;
};

export function stockholmCalendarToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MARIA_CALENDAR_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const find = (key: string) => parts.find((part) => part.type === key)?.value ?? "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}

export function parseMariaCalendarDay(date: string) {
  const parsed = parseLocalDateTime(`${date}T00:00`);
  if (!parsed || parsed.year < 2026 || parsed.year > 2036) return null;
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  return [0, 5, 6].includes(weekday) ? { ...parsed, weekday } : null;
}

export function nextMariaCalendarDay(now = new Date()) {
  const today = stockholmCalendarToday(now);
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86_400_000)
      .toISOString().slice(0, 10);
    if (parseMariaCalendarDay(date)) return date;
  }
  return today;
}

function clockMinutes(value: string) {
  const match = /^([01][0-9]|2[0-3]):(00|30)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function convert(date: string, minute: number) {
  const hour = Math.floor(minute / 60);
  const minutes = minute % 60;
  const parts = parseLocalDateTime(
    `${date}T${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  );
  if (!parts) return null;
  const instant = localDateTimeToUtc(parts, MARIA_CALENDAR_ZONE);
  return isValidLocalTime(parts, instant, MARIA_CALENDAR_ZONE) && Number.isFinite(instant.getTime())
    ? instant.toISOString() : null;
}

export function mariaCalendarIntervals(date: string, firstStart: string, lastStart: string): MariaCalendarInterval[] | null {
  if (!parseMariaCalendarDay(date)) return null;
  const first = clockMinutes(firstStart);
  const last = clockMinutes(lastStart);
  if (first === null || last === null || first > last || last + 30 >= 1440
    || (last - first) / 30 > 40) return null;
  const result: MariaCalendarInterval[] = [];
  for (let minute = first; minute <= last; minute += 30) {
    const startsAt = convert(date, minute);
    const endsAt = convert(date, minute + 30);
    if (!startsAt || !endsAt || Date.parse(endsAt) - Date.parse(startsAt) !== 1_800_000) return null;
    const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const after = minute + 30;
    const endClock = `${String(Math.floor(after / 60)).padStart(2, "0")}:${String(after % 60).padStart(2, "0")}`;
    result.push({ clock, endClock, startsAt, endsAt });
  }
  return result;
}

export function mariaCalendarDayBounds(date: string) {
  const day = parseMariaCalendarDay(date);
  if (!day) return null;
  const midnight = convert(date, 0);
  const tomorrow = new Date(Date.UTC(day.year, day.month - 1, day.day + 1)).toISOString().slice(0, 10);
  const nextMidnight = convert(tomorrow, 0);
  if (!midnight || !nextMidnight || Date.parse(midnight) >= Date.parse(nextMidnight)) return null;
  return { startsAt: midnight, endsAt: nextMidnight };
}

export function mariaCalendarDateAllowed(date: string, now = new Date()) {
  return Boolean(parseMariaCalendarDay(date)) && date >= stockholmCalendarToday(now);
}
