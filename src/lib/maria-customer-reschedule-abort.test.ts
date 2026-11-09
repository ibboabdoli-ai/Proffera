import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  send: vi.fn(),
  locked: vi.fn(),
  persistedAttempt: "",
  persistedState: "sending",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: () => Object.assign(fixture.sql, { transaction: fixture.transaction }) }));
vi.mock("@/lib/maria-booking-runtime", () => ({
  getMariaBookingReadiness: async () => ({ enabled: true, workspaceId: "11111111-1111-4111-8111-111111111111" }),
}));
vi.mock("@/lib/maria-booking-availability", () => ({
  getMariaAvailability: async () => ({ ok: true, slots: ["09:00"] }),
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  getMariaBookingPortalBase: () => "https://synthetic-preview.invalid",
  isMariaBookingRecipientAllowed: () => true,
}));
vi.mock("@/lib/public-booking-policy", () => ({
  parseLocalDateTime: () => ({ year: 2027, minutes: 0 }),
  validatePublicBookingPolicy: () => ({
    start: new Date("2027-06-18T09:00:00.000Z"),
    end: new Date("2027-06-18T11:00:00.000Z"),
  }),
}));
vi.mock("@/features/email/booking-change-email", () => ({
  sendBookingChangeEmails: fixture.send,
}));
vi.mock("@/lib/maria-booking-notification-lock", () => ({
  withMariaBookingNotificationLock: fixture.locked,
}));

import { rescheduleMariaCustomerBooking } from "@/lib/maria-customer-reschedule";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const noticeEventId = "44444444-4444-4444-8444-444444444444";
const attempt = "2027-06-17 08:00:00+00";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.persistedAttempt = attempt;
  fixture.persistedState = "sending";
  fixture.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join("?");
    if (query.includes("select b.service_id")) {
      return [{
        booked_starts_at: "2027-06-11T09:00:00.000Z",
        booked_ends_at: "2027-06-11T11:00:00.000Z",
        public_slug: "maria-bridal-trial-2027",
        duration_minutes: 120, buffer_before_minutes: 0,
        buffer_after_minutes: 0, minimum_notice_minutes: 0,
        maximum_advance_days: 730, customer_email: "qa@example.invalid",
      }];
    }
    if (query.includes("update customer_events e")) {
      // Simulate a CAS against a newer attempt in the same event row.
      const attemptedAt = values.find(value => value === attempt);
      if (attemptedAt === fixture.persistedAttempt) {
        fixture.persistedState = "failed";
        return [{ id: noticeEventId }];
      }
      return [];
    }
    return [{ present: 1 }];
  });
  fixture.transaction.mockResolvedValue([[], [{
    notice_event_id: noticeEventId, notice_attempted_at: attempt,
    notice_revision: "2027-06-17T08:00:00.000Z",
    customer_email: "qa@example.invalid",
    customer_name: "Synthetic customer", owner_email: null,
    company_name: "Makeup by Maria", service_name: "Brudsmink",
    old_starts_at: "2027-06-11T09:00:00.000Z",
    old_ends_at: "2027-06-11T11:00:00.000Z",
    city: "Södertälje",
  }]]);
  fixture.locked.mockImplementation(async (_workspace: string, action: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    controller.abort();
    // Simulate expiry during/just before the post-commit booking read.
    await action(controller.signal);
    throw new Error("Maria notification deadline exceeded");
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Maria reschedule pre-dispatch timeout safety", () => {
  it("releases only the original proven-unsent attempt by CAS without contacting Brevo", async () => {
    const result = await rescheduleMariaCustomerBooking({
      workspaceId, customerId, bookingId,
      startsAtLocal: "2027-06-18T09:00", token: "synthetic-token",
      language: "sv",
    });
    expect(result).toEqual({ ok: true, emailWarning: true });
    expect(fixture.send).not.toHaveBeenCalled();
    const recoveryCall = fixture.sql.mock.calls.find(([parts]) =>
      (parts as TemplateStringsArray).join("?").includes("update customer_events e"));
    expect(recoveryCall).toBeDefined();
    const sql = (recoveryCall![0] as TemplateStringsArray).join("?");
    expect(sql).toContain("notice_attempted_at");
    expect(sql).toContain("notice_customer'='sending'");
    expect(recoveryCall).toContain(noticeEventId);
    expect(recoveryCall).toContain(attempt);
    expect(recoveryCall).toContain("failed");
  });

  it("cannot overwrite a newer sending attempt after an older pre-dispatch abort", async () => {
    fixture.locked.mockImplementationOnce(async (_workspace: string,
      action: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController();
      // Another manager's claim updates the same event's attempt timestamp.
      fixture.persistedAttempt = "2027-06-17 08:01:00+00";
      controller.abort();
      await action(controller.signal);
      throw new Error("Maria notification deadline exceeded");
    });
    expect(await rescheduleMariaCustomerBooking({
      workspaceId,customerId,bookingId,
      startsAtLocal:"2027-06-18T09:00",token:"synthetic-token",language:"en",
    })).toEqual({ok:true,emailWarning:true});
    const recoveryCall = fixture.sql.mock.calls.find(([parts]) =>
      (parts as TemplateStringsArray).join("?").includes("update customer_events e"));
    expect(recoveryCall).toBeDefined();
    expect((recoveryCall![0] as TemplateStringsArray).join("?"))
      .toContain("metadata->>'notice_attempted_at'=?");
    expect(recoveryCall).toContain(attempt);
    expect(fixture.persistedAttempt).toBe("2027-06-17 08:01:00+00");
    expect(fixture.persistedState).toBe("sending");
    expect(fixture.send).not.toHaveBeenCalled();
  });
});
