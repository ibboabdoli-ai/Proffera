import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public booking slot memoization", () => {
  it("stabilizes slot callbacks and makes memo dependencies explicit", () => {
    const form = source("src/app/boka/[slug]/booking-request-form.tsx");

    expect(form).toContain("useCallback, useEffect, useMemo, useState");
    expect(form).toContain("const slotsForStaff = useCallback(");
    expect(form).toContain("}, [referenceTime, timeZone]);");
    expect(form).toContain("const slotsForDate = useCallback(");
    expect(form).toContain(
      "}, [bookingHours, busyBookings, referenceTime, slotsForStaff, staff, staffChoice, timeZone]);",
    );
    expect(form).toContain(
      "[date, selectedService, slotsForDate]",
    );
    expect(form).toContain("[services, slotsForDate, today]");
    expect(form).not.toContain(
      "[selectedService, date, staff, staffChoice, bookingHours, busyBookings, referenceTime, timeZone]",
    );
  });
});
