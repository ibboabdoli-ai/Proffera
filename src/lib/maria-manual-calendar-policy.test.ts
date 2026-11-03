import { describe, expect, it } from "vitest";
import {
  mariaCalendarDateAllowed, mariaCalendarDayBounds,
  mariaCalendarIntervals, nextMariaCalendarDay, stockholmCalendarToday,
} from "./maria-manual-calendar-policy";

describe("Maria manual calendar Stockholm date and interval policy", () => {
  it("defaults to the next Friday, Saturday or Sunday without changing the working schedule", () => {
    expect(stockholmCalendarToday(new Date("2026-11-03T12:00:00Z"))).toBe("2026-11-03");
    expect(nextMariaCalendarDay(new Date("2026-11-03T12:00:00Z"))).toBe("2026-11-06");
    expect(nextMariaCalendarDay(new Date("2026-11-08T09:00:00Z"))).toBe("2026-11-08");
  });

  it("shows independently controllable start markers in the Friday booking-start window", () => {
    const intervals = mariaCalendarIntervals("2026-11-06", "06:00", "10:00");
    expect(intervals).toHaveLength(9);
    expect(intervals?.[0]).toEqual({
      clock: "06:00", endClock: "06:30",
      startsAt: "2026-11-06T05:00:00.000Z",
      endsAt: "2026-11-06T05:30:00.000Z",
    });
    expect(intervals?.at(-1)?.clock).toBe("10:00");
    expect(intervals?.at(-1)?.endClock).toBe("10:30");
  });

  it("rejects weekdays, past dates, invalid time steps, reversed hours and out-of-range years", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    expect(mariaCalendarDateAllowed("2026-11-06", now)).toBe(true);
    expect(mariaCalendarDateAllowed("2026-10-30", now)).toBe(false);
    expect(mariaCalendarDateAllowed("2026-11-09", now)).toBe(false);
    expect(mariaCalendarDateAllowed("2037-01-02", now)).toBe(false);
    expect(mariaCalendarIntervals("2026-11-09", "06:00", "10:00")).toBeNull();
    expect(mariaCalendarIntervals("2026-11-06", "06:10", "10:00")).toBeNull();
    expect(mariaCalendarIntervals("2026-11-06", "11:00", "10:00")).toBeNull();
    expect(mariaCalendarIntervals("2026-11-06", "06:00", "23:30")).toBeNull();
  });

  it("does not hide valid hours when a wide Sunday window crosses Stockholm DST", () => {
    const spring = mariaCalendarIntervals("2027-03-28", "00:00", "10:00");
    const autumn = mariaCalendarIntervals("2027-10-31", "00:00", "10:00");
    expect(spring).not.toBeNull();
    expect(autumn).not.toBeNull();
    expect(spring?.some(slot => slot.clock === "06:00")).toBe(true);
    expect(autumn?.some(slot => slot.clock === "06:00")).toBe(true);
    expect(spring?.some(slot => slot.clock === "02:00")).toBe(false);
    expect(autumn?.some(slot => slot.clock === "02:30")).toBe(false);
    expect(mariaCalendarIntervals("2026-11-06", "00:00", "20:00")).toHaveLength(41);
  });

  it("handles both Swedish DST transitions without missing or overlapping the morning intervals", () => {
    const spring = mariaCalendarIntervals("2027-03-28", "06:00", "10:00");
    const autumn = mariaCalendarIntervals("2027-10-31", "06:00", "10:00");
    expect(spring).toHaveLength(9);
    expect(autumn).toHaveLength(9);
    expect(spring?.[0]?.startsAt).toBe("2027-03-28T04:00:00.000Z");
    expect(autumn?.[0]?.startsAt).toBe("2027-10-31T05:00:00.000Z");
    const springDay = mariaCalendarDayBounds("2027-03-28");
    const autumnDay = mariaCalendarDayBounds("2027-10-31");
    expect(Date.parse(springDay!.endsAt)-Date.parse(springDay!.startsAt)).toBe(23*60*60*1000);
    expect(Date.parse(autumnDay!.endsAt)-Date.parse(autumnDay!.startsAt)).toBe(25*60*60*1000);
  });
});
