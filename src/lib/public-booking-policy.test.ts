import { describe, expect, it } from "vitest";

import {
  parseLocalDateTime,
  stockholmDateToUtc,
  timeToMinutes,
  validatePublicBookingPolicy,
} from "@/lib/public-booking-policy";

const service = {
  durationMinutes: 60,
  bufferBeforeMinutes: 15,
  bufferAfterMinutes: 15,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 30,
};

const bookingHour = {
  opensAt: "09:00",
  closesAt: "17:00",
  isClosed: false,
};

describe("public booking server policy", () => {
  it("rejects impossible calendar dates", () => {
    expect(parseLocalDateTime("2026-02-30T10:00")).toBeNull();
    expect(parseLocalDateTime("2026-13-01T10:00")).toBeNull();
  });

  it("converts Stockholm local time across DST", () => {
    const parsed = parseLocalDateTime("2026-07-28T09:00");
    expect(parsed).not.toBeNull();
    expect(stockholmDateToUtc(parsed!).toISOString()).toBe("2026-07-28T07:00:00.000Z");
  });

  it("validates booking-hour values", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("09:99")).toBeNull();
  });

  it("returns notice and advance errors", () => {
    const now = stockholmDateToUtc(parseLocalDateTime("2026-07-28T08:00")!);
    expect(validatePublicBookingPolicy({
      startsAt: "2026-07-28T09:00",
      now,
      service,
      bookingHour,
    }).error).toBe("notice");

    expect(validatePublicBookingPolicy({
      startsAt: "2026-08-28T09:00",
      now,
      service,
      bookingHour,
    }).error).toBe("advance");
  });

  it("returns missing and closed-hours errors", () => {
    const now = stockholmDateToUtc(parseLocalDateTime("2026-07-27T08:00")!);
    expect(validatePublicBookingPolicy({
      startsAt: "2026-07-28T10:00",
      now,
      service,
      bookingHour: null,
    }).error).toBe("hours_missing");

    expect(validatePublicBookingPolicy({
      startsAt: "2026-07-28T10:00",
      now,
      service,
      bookingHour: { ...bookingHour, isClosed: true },
    }).error).toBe("hours");
  });

  it("accepts a valid slot and returns its interval", () => {
    const now = stockholmDateToUtc(parseLocalDateTime("2026-07-27T08:00")!);
    const result = validatePublicBookingPolicy({
      startsAt: "2026-07-28T10:00",
      now,
      service,
      bookingHour,
    });

    expect(result.error).toBeNull();
    expect(result.start?.toISOString()).toBe("2026-07-28T08:00:00.000Z");
    expect(result.end?.toISOString()).toBe("2026-07-28T09:00:00.000Z");
  });
});
