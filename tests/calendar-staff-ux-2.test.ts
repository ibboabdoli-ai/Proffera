import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Calendar and Staff UX 2.0", () => {
  it("scopes semantic presentation across Calendar and Staff while preserving calendar metadata", () => {
    const css = source("src/components/dashboard/calendar-staff-ux-2.module.css");
    const calendarLayout = source("src/app/dashboard/kalender/layout.tsx");
    const staffLayout = source("src/app/dashboard/personal/layout.tsx");

    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-line)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
    expect(calendarLayout).toContain('manifest: "/dashboard/kalender/manifest.webmanifest"');
    expect(calendarLayout).toContain('apple: "/brand/proffera-calendar-app-icon.svg"');
    expect(calendarLayout).toContain("styles.scope");
    expect(staffLayout).toContain("styles.scope");
  });

  it("preserves calendar drag-and-drop move validation and workspace timezone behavior", () => {
    const calendarPage = source("src/app/dashboard/kalender/page.tsx");
    const calendar = source("src/components/dashboard/business-calendar.tsx");

    expect(calendarPage).toContain("getDashboardCalendarEvents");
    expect(calendarPage).toContain("getDashboardWorkspaceSettings");
    expect(calendarPage).toContain("workspaceSettings.timeZone");
    expect(calendar).toContain('fetch("/api/dashboard/calendar/move"');
    expect(calendar).toContain("bookingId: draggedBooking.id");
    expect(calendar).toContain("localStartsAt");
    expect(calendar).toContain('staffId: targetStaffId === "unassigned" ? "" : targetStaffId');
    expect(calendar).toContain('staff_conflict: "Medarbetaren har redan en bokning under den tiden."');
    expect(calendar).toContain('staff_hours: "Tiden ligger utanför medarbetarens arbetstid."');
    expect(calendar).toContain('staff_time_off: "Medarbetaren har frånvaro eller rast under den tiden."');
  });

  it("preserves staff creation, activation, planning and booking assignment actions", () => {
    const staff = source("src/app/dashboard/personal/page.tsx");
    const planning = source("src/app/dashboard/personal/tider/page.tsx");
    const assignments = source("src/app/dashboard/personal/bokningar/page.tsx");

    expect(staff).toContain("createDashboardStaffMember");
    expect(staff).toContain("setDashboardStaffActive");
    expect(staff).toContain('name="staff_id"');
    expect(staff).toContain('name="is_active"');
    expect(planning).toContain("createStaffSchedule");
    expect(planning).toContain("createStaffTimeOff");
    expect(planning).toContain("deleteStaffPlanningEntry");
    expect(planning).toContain('name="start_time"');
    expect(planning).toContain('name="ends_at"');
    expect(assignments).toContain("assignStaffToBooking");
    expect(assignments).toContain('name="booking_id"');
    expect(assignments).toContain('name="staff_id"');
    expect(assignments).toContain("getDashboardWorkspaceSettings");
  });
});
