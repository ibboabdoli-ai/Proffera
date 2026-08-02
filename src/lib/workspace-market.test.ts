import { describe, expect, it } from "vitest";

import {
  getWorkspaceMarketCountry,
  resolveWorkspaceMarket,
  workspaceMarketCountries,
} from "./workspace-market";
import {
  isValidLocalTime,
  localDateTimeToUtc,
  parseLocalDateTime,
  validatePublicBookingPolicy,
} from "./public-booking-policy";

describe("workspace market policy", () => {
  it("accepts the supported B2B markets with their only permitted currency", () => {
    expect(resolveWorkspaceMarket({ countryCode: "SE", timeZone: "Europe/Stockholm", billingCurrency: "SEK" })).toEqual({
      countryCode: "SE", timeZone: "Europe/Stockholm", billingCurrency: "SEK",
    });
    expect(resolveWorkspaceMarket({ countryCode: "DE", timeZone: "Europe/Berlin", billingCurrency: "EUR" })).toEqual({
      countryCode: "DE", timeZone: "Europe/Berlin", billingCurrency: "EUR",
    });
    expect(resolveWorkspaceMarket({ countryCode: "GB", timeZone: "Europe/London", billingCurrency: "GBP" })).toEqual({
      countryCode: "GB", timeZone: "Europe/London", billingCurrency: "GBP",
    });
  });

  it("rejects an unsupported country, time zone, or currency pairing", () => {
    expect(resolveWorkspaceMarket({ countryCode: "US", timeZone: "Europe/London", billingCurrency: "GBP" })).toBeNull();
    expect(resolveWorkspaceMarket({ countryCode: "GB", timeZone: "America/New_York", billingCurrency: "GBP" })).toBeNull();
    expect(resolveWorkspaceMarket({ countryCode: "GB", timeZone: "Europe/London", billingCurrency: "EUR" })).toBeNull();
  });

  it("keeps the country catalogue internally complete", () => {
    expect(workspaceMarketCountries).toHaveLength(28);
    expect(getWorkspaceMarketCountry("GB")?.defaultTimeZone).toBe("Europe/London");
    expect(getWorkspaceMarketCountry("SE")?.currency).toBe("SEK");
  });

  it("rejects skipped UK local time at daylight-saving transition", () => {
    const skipped = parseLocalDateTime("2026-03-29T01:30");
    expect(skipped).not.toBeNull();
    expect(isValidLocalTime(skipped!, undefined, "Europe/London")).toBe(false);
  });

  it("creates bookings in the workspace time zone, not Stockholm", () => {
    const localStart = parseLocalDateTime("2026-07-28T09:00");
    expect(localStart).not.toBeNull();
    expect(localDateTimeToUtc(localStart!, "Europe/London").toISOString()).toBe("2026-07-28T08:00:00.000Z");

    const result = validatePublicBookingPolicy({
      startsAt: "2026-07-28T10:00",
      now: new Date("2026-07-27T08:00:00.000Z"),
      timeZone: "Europe/London",
      service: {
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        minimumNoticeMinutes: 0,
        maximumAdvanceDays: 30,
      },
      bookingHour: { opensAt: "09:00", closesAt: "17:00", isClosed: false },
    });

    expect(result.error).toBeNull();
    expect(result.start?.toISOString()).toBe("2026-07-28T09:00:00.000Z");
  });
});
