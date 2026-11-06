import { describe, expect, it } from "vitest";

import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import { availableMariaStartSlots } from "@/lib/maria-booking-slots";
import { mariaCalendarIntervals } from "@/lib/maria-manual-calendar-policy";
import { readMariaYearDescription, readMariaYearPrice } from "@/lib/maria-year-editor";

// Authorization, public_status persistence and advisory-lock serialization
// are exercised against actual writers in maria-manager-saves-postgres,
// maria-manual-calendar-postgres and maria-status-reactivation-postgres.
// Keep these fast contracts executable rather than inspecting source fragments.
describe("Maria Preview year editor and booking behavior", () => {
  it("accepts fractional yearly prices while rejecting malformed values", () => {
    expect(readMariaYearPrice("6900.50")).toBe(6900.5);
    expect(readMariaYearPrice("6900,75")).toBe(6900.75);
    expect(readMariaYearPrice("")).toBeNull();
    expect(() => readMariaYearPrice("6 900")).toThrow("INVALID_PRICE");
  });

  it("preserves editable descriptions without permitting control characters", () => {
    expect(readMariaYearDescription("  Provsminkning ingår  ", "Default"))
      .toBe("Provsminkning ingår");
    expect(readMariaYearDescription("", "Default")).toBe("Default");
    expect(() => readMariaYearDescription("Bad\u0000", "Default"))
      .toThrow("INVALID_DESCRIPTION");
  });

  it("rejects unauthorized recipients and all non-Preview environments", () => {
    const env = {
      VERCEL_ENV: "preview",
      VERCEL_URL: "qa.vercel.app",
      PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "qa@example.invalid",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: "qa@example.invalid",
    } as NodeJS.ProcessEnv;
    expect(isMariaPreviewTestRecipient("qa@example.invalid", env)).toBe(true);
    expect(isMariaPreviewTestRecipient("other@example.invalid", env)).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...env, VERCEL_ENV: "production",
    })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...env, VERCEL_ENV: "development",
    })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...env, PROFFERA_PREVIEW_EMAIL_RECIPIENT: "other@example.invalid",
    })).toBe(false);
  });

  it("closes only the requested appointment start without blocking adjacent starts", () => {
    const date = "2027-06-18"; // Friday in Stockholm
    const controls = mariaCalendarIntervals(date, "06:00", "07:00");
    expect(controls?.map(x => x.clock)).toEqual(["06:00", "06:30", "07:00"]);
    const closedStart = controls?.find(x => x.clock === "06:30")?.startsAt;
    expect(closedStart).toBeDefined();
    const slots = availableMariaStartSlots({
      date, earliestStart: "06:00", latestStart: "07:00",
      durationMinutes: 180, bufferBeforeMinutes: 0, bufferAfterMinutes: 0,
      minimumNoticeMinutes: 0, maximumAdvanceDays: 365,
      timeZone: "Europe/Stockholm",
      busy: [], manuallyClosedStartsAt: [closedStart!],
      now: new Date("2027-06-01T10:00:00.000Z"),
    });
    expect(slots).toEqual(["06:00", "07:00"]);
  });
});
