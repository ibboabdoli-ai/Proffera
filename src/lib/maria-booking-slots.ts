import { localTimeToUtc } from "@/lib/public-booking-availability";
import { parseLocalDateTime, timeToMinutes } from "@/lib/public-booking-policy";

export type MariaBusyInterval = {
  startsAt: string;
  endsAt: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
};

type MariaStartWindow = {
  date: string;
  earliestStart: string;
  latestStart: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  timeZone: "Europe/Stockholm";
  stepMinutes?: number;
  busy: MariaBusyInterval[];
  now: Date;
};

function safeBuffer(value: number | undefined) {
  return Number.isInteger(value) && value! >= 0 && value! <= 1440 ? value! : 0;
}

export function availableMariaStartSlots(input: MariaStartWindow): string[] {
  const parsedDate = parseLocalDateTime(`${input.date}T00:00`);
  const opening = timeToMinutes(input.earliestStart);
  const latest = timeToMinutes(input.latestStart);
  const step = input.stepMinutes ?? 30;
  if (
    !parsedDate || opening === null || latest === null || opening > latest
    || ![15, 30, 60].includes(step)
    || !Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440
    || !Number.isInteger(input.minimumNoticeMinutes) || input.minimumNoticeMinutes < 0
    || !Number.isInteger(input.maximumAdvanceDays) || input.maximumAdvanceDays < 1
    || !Number.isFinite(input.now.getTime())
  ) return [];

  const weekday = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay();
  if (weekday !== 5 && weekday !== 6) return [];

  const effectiveBusy = input.busy.map((entry) => {
    const start = Date.parse(entry.startsAt);
    const end = Date.parse(entry.endsAt);
    return {
      start: start - safeBuffer(entry.bufferBeforeMinutes) * 60_000,
      end: end + safeBuffer(entry.bufferAfterMinutes) * 60_000,
    };
  });
  const now = input.now.getTime();
  const slots: string[] = [];
  for (let minute = opening; minute <= latest; minute += step) {
    const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const start = localTimeToUtc(input.date, clock, input.timeZone).getTime();
    if (!Number.isFinite(start) || start < now + input.minimumNoticeMinutes * 60_000
      || start > now + input.maximumAdvanceDays * 86_400_000) continue;

    // The latest start is NOT the end of the working appointment.
    // One operator cannot accept any overlapping appointment, including
    // an earlier offered slot that would run into an existing later booking.
    const occupiedFrom = start - safeBuffer(input.bufferBeforeMinutes) * 60_000;
    const occupiedUntil = start
      + (input.durationMinutes + safeBuffer(input.bufferAfterMinutes)) * 60_000;
    if (effectiveBusy.some((busy) =>
      Number.isFinite(busy.start) && Number.isFinite(busy.end)
      && busy.start < occupiedUntil && busy.end > occupiedFrom
    )) continue;
    slots.push(clock);
  }
  return slots;
}
