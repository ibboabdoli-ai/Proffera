import { describe, expect, it } from "vitest";
import { availableMariaStartSlots } from "./maria-booking-slots";

const reference = new Date("2026-10-01T00:00:00Z");
const settings = {
  date: "2026-10-16", // Friday in Stockholm (UTC+2)
  earliestStart: "06:00",
  latestStart: "10:00",
  durationMinutes: 180,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 0,
  maximumAdvanceDays: 730,
  timeZone: "Europe/Stockholm" as const,
  now: reference,
};

function withAppointment(startsAt: string, endsAt: string) {
  return availableMariaStartSlots({
    ...settings,
    busy: [{ startsAt, endsAt }],
  });
}

describe("Maria one-person bridal makeup booking", () => {
  it("offers appointment starts through 10 even though work ends after 10", () => {
    expect(availableMariaStartSlots({...settings, busy:[]})).toEqual([
      "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00",
    ]);
  });

  it("06:00–09:00 booked blocks every overlapping start before 09:00", () => {
    expect(withAppointment("2026-10-16T04:00:00Z","2026-10-16T07:00:00Z"))
      .toEqual(["09:00","09:30","10:00"]);
  });

  it("07:00–10:00 booked blocks 06:00, 06:30 and all starts before 10:00", () => {
    expect(withAppointment("2026-10-16T05:00:00Z","2026-10-16T08:00:00Z"))
      .toEqual(["10:00"]);
  });

  it("08:00–11:00 booked also blocks earlier starts at 06:00 and 07:00", () => {
    expect(withAppointment("2026-10-16T06:00:00Z","2026-10-16T09:00:00Z"))
      .toEqual([]);
  });

  it("respects optional pause after the prior appointment", () => {
    expect(availableMariaStartSlots({
      ...settings,
      busy:[{ startsAt:"2026-10-16T04:00:00Z", endsAt:"2026-10-16T07:00:00Z",
        bufferAfterMinutes:30 }],
    })).toEqual(["09:30","10:00"]);
  });

  it("blocks Friday slots on a weekday other than Friday or Saturday", () => {
    expect(availableMariaStartSlots({...settings,date:"2026-10-15",busy:[]})).toEqual([]);
  });

  it("rejects dates beyond the booking advance horizon", () => {
    expect(availableMariaStartSlots({...settings,now:new Date("2026-10-15T12:00:00Z"),
      maximumAdvanceDays:1,date:"2026-10-30",busy:[]})).toEqual([]);
  });

  it("ignores an appointment ending exactly when a new appointment starts", () => {
    expect(withAppointment("2026-10-16T07:00:00Z","2026-10-16T10:00:00Z"))
      .toEqual(["06:00"]);
  });
});
