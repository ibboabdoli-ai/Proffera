import { describe, expect, it } from "vitest";

import {
  addDaysToDateInput,
  getAvailableBookingTimes,
  stockholmDateInput,
  stockholmLocalToUtc,
} from "@/lib/public-booking-availability";

const service = {
  durationMinutes: 60,
  bufferBeforeMinutes: 15,
  bufferAfterMinutes: 15,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 30,
};

const hours = {
  opensAt: "09:00",
  closesAt: "12:00",
  isClosed: false,
};

describe("public booking availability policy", () => {
  it("converts Stockholm local time to UTC across summer time", () => {
    expect(stockholmLocalToUtc("2026-07-28", "09:00").toISOString()).toBe("2026-07-28T07:00:00.000Z");
  });

  it("formats dates and advances the date input deterministically", () => {
    expect(stockholmDateInput(new Date("2026-07-27T10:00:00.000Z"))).toBe("2026-07-27");
    expect(addDaysToDateInput("2026-07-27", 30)).toBe("2026-08-26");
  });

  it("removes slots inside minimum notice", () => {
    const referenceTimeMs = stockholmLocalToUtc("2026-07-28", "08:00").getTime();
    expect(getAvailableBookingTimes({
      date: "2026-07-28",
      service,
      hours,
      busyBookings: [],
      referenceTimeMs,
    })).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("removes slots beyond maximum advance", () => {
    const referenceTimeMs = stockholmLocalToUtc("2026-07-01", "08:00").getTime();
    expect(getAvailableBookingTimes({
      date: "2026-08-01",
      service,
      hours,
      busyBookings: [],
      referenceTimeMs,
    })).toEqual([]);
  });

  it("applies buffers from both the requested and existing booking", () => {
    const referenceTimeMs = stockholmLocalToUtc("2026-07-27", "08:00").getTime();
    const busyStart = stockholmLocalToUtc("2026-07-28", "10:30");
    const busyEnd = stockholmLocalToUtc("2026-07-28", "11:30");

    expect(getAvailableBookingTimes({
      date: "2026-07-28",
      service,
      hours,
      busyBookings: [{
        startsAt: busyStart.toISOString(),
        endsAt: busyEnd.toISOString(),
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 15,
      }],
      referenceTimeMs,
    })).toEqual(["09:00"]);
  });

  it("returns no slots for a closed day", () => {
    expect(getAvailableBookingTimes({
      date: "2026-07-28",
      service,
      hours: { ...hours, isClosed: true },
      busyBookings: [],
      referenceTimeMs: stockholmLocalToUtc("2026-07-27", "08:00").getTime(),
    })).toEqual([]);
  });
});
