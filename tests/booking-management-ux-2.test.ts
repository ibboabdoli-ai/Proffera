import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Booking management UX 2.0", () => {
  it("applies the shared semantic workspace layer without weakening the booking module guard", () => {
    const layout = source("src/app/dashboard/bokningar/layout.tsx");
    const css = source("src/components/dashboard/secondary-workspace-ux-2.module.css");

    expect(layout).toContain("DashboardModuleGuard");
    expect(layout).toContain('moduleId="online_booking"');
    expect(layout).toContain("secondary-workspace-ux-2.module.css");
    expect(layout).toContain("styles.scope");
    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("preserves the booking overview data source and booking routes", () => {
    const page = source("src/app/dashboard/bokningar/page.tsx");

    expect(page).toContain("getDashboardBookingsInStockholm");
    expect(page).toContain('"/dashboard/bokningar/ny"');
    expect(page).toContain("`/dashboard/bokningar/${booking.id}`");
  });

  it("preserves manual booking creation permissions, taxonomy and conflict protection", () => {
    const page = source("src/app/dashboard/bokningar/ny/page.tsx");

    expect(page).toContain("getUserWorkspaceAccess");
    expect(page).toContain("canManageWorkspaceSettings");
    expect(page).toContain('hasDashboardModuleAccess("online_booking")');
    expect(page).toContain("serviceTaxonomy");
    expect(page).toContain("createDashboardBooking");
    expect(page).toContain("BookingTimeConflictError");
  });

  it("preserves booking detail status, reschedule and customer notification boundaries", () => {
    const page = source("src/app/dashboard/bokningar/[id]/page.tsx");

    expect(page).toContain("getUserWorkspaceAccess");
    expect(page).toContain("canManageWorkspaceSettings");
    expect(page).toContain('hasDashboardModuleAccess("online_booking")');
    expect(page).toContain("updateDashboardBookingStatus");
    expect(page).toContain("rescheduleDashboardBooking");
    expect(page).toContain("sendBookingStatusEmail");
    expect(page).toContain("sendBookingCustomerSms");
  });

  it("preserves one-time and recurring availability block management", () => {
    const page = source("src/app/dashboard/bokningar/blockera/page.tsx");

    expect(page).toContain("getUserWorkspaceAccess");
    expect(page).toContain("canManageWorkspaceSettings");
    expect(page).toContain('hasDashboardModuleAccess("online_booking")');
    expect(page).toContain("createDashboardAvailabilityBlock");
    expect(page).toContain("createDashboardRecurringAvailabilityBlocks");
    expect(page).toContain("deleteDashboardAvailabilityBlock");
  });
});
