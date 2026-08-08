import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function count(sourceText: string, pattern: RegExp) {
  return [...sourceText.matchAll(pattern)].length;
}

const dashboardBookingReaders = [
  "src/lib/dashboard-db.ts",
  "src/lib/dashboard-bookings-db.ts",
  "src/lib/dashboard-booking-detail-db.ts",
  "src/lib/dashboard-booking-status.ts",
  "src/lib/dashboard-calendar.ts",
  "src/lib/dashboard-staff-bookings.ts",
] as const;

describe("Workspace tenant join boundaries", () => {
  it.each(dashboardBookingReaders)("keeps booking-to-customer joins workspace-scoped in %s", (path) => {
    const file = source(path);
    const customerJoins = count(file, /(?:left\s+)?join\s+customers\s+c\b/gi);
    const tenantBoundCustomerJoins = count(
      file,
      /(?:left\s+)?join\s+customers\s+c\s+on\s+c\.id\s*=\s*b\.customer_id\s+and\s+c\.workspace_id\s*=\s*b\.workspace_id/gi,
    );

    expect(customerJoins).toBeGreaterThan(0);
    expect(tenantBoundCustomerJoins).toBe(customerJoins);
  });
});
