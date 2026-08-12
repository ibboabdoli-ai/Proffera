import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("booking and service job lifecycle synchronization", () => {
  it("keeps dashboard reschedules limited to active bookings and syncs an existing service job", () => {
    const code = source("src/lib/dashboard-booking-reschedule.ts");

    expect(code).toContain('["requested", "confirmed"].includes(String(existing.status))');
    expect(code).toContain("update workspace_service_jobs job");
    expect(code).toContain("scheduled_starts_at = ${newStart.toISOString()}::timestamptz");
    expect(code).toContain("scheduled_ends_at = ${newEnd.toISOString()}::timestamptz");
    expect(code).toContain("dashboard_booking_reschedule");
    expect(code).toContain("'booking',");
    expect(code).toContain("'event_subtype', 'booking_rescheduled'");
  });

  it("cancels the booking-backed service job when a customer cancels from the portal", () => {
    const code = source("src/lib/customer-calendar.ts");

    expect(code).toContain("with cancelled_booking as");
    expect(code).toContain("and w.id::text = b.workspace_id");
    expect(code).toContain("update workspace_service_jobs job");
    expect(code).toContain("status = 'cancelled'");
    expect(code).toContain("cancelled_at = now()");
    expect(code).toContain("customer_portal_cancellation");
    expect(code).toContain("'booking_id', ${bookingId}::text");
    expect(code).toContain("Bokning avbokad av kund");
  });

  it("syncs service-job schedule and CRM history when a customer reschedules", () => {
    const code = source("src/lib/customer-booking-reschedule.ts");

    expect(code).toContain("join workspaces w on w.id::text = b.workspace_id");
    expect(code).toContain("with updated_booking as");
    expect(code).toContain("update workspace_service_jobs job");
    expect(code).toContain("scheduled_starts_at = ${start.toISOString()}::timestamptz");
    expect(code).toContain("scheduled_ends_at = ${end.toISOString()}::timestamptz");
    expect(code).toContain("customer_portal_reschedule");
    expect(code).toContain("'booking_id', ${bookingId}::text");
    expect(code).toContain("'previous_starts_at', ${oldStart}::text");
    expect(code).toContain("'starts_at', ${start.toISOString()}::text");
    expect(code).toContain("'booking_status', ${nextStatus}::text");
    expect(code).toContain("'event_subtype', 'booking_rescheduled'");
    expect(code).toContain("'old_status', ${String(booking.old_status)}::text");
    expect(code).toContain("'new_status', ${nextStatus}::text");
    expect(code).toContain("Bokning ombokad av kund");
  });

  it("keeps completion connected to verified review delivery", () => {
    const code = source("src/lib/dashboard-booking-status.ts");

    expect(code).toContain('status === "completed"');
    expect(code).toContain("deliverVerifiedReviewInvitation(bookingId)");
    expect(code).toContain("source_completion_evidence");
  });
});