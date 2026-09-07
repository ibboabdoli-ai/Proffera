import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as string[],
  reminderRows: [] as Array<Record<string, unknown>>,
  claimCount: 0,
  claimInFlight: 0,
  claimOverlapObserved: false,
  requireConcurrentClaimOverlap: false,
  releaseFirstClaim: undefined as (() => void) | undefined,
}));

const mocks = vi.hoisted(() => ({
  sendBookingReminderEmail: vi.fn(),
  sendBookingReminderSms: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({ resolveDatabaseUrl: () => "postgres://test" }));
vi.mock("@/features/email/booking-reminder-email", () => ({
  sendBookingReminderEmail: mocks.sendBookingReminderEmail,
}));
vi.mock("@/features/sms/booking-reminder-sms", () => ({
  sendBookingReminderSms: mocks.sendBookingReminderSms,
}));
vi.mock("@/lib/customer-calendar", () => ({ createCustomerCalendarToken: vi.fn(() => "token") }));
vi.mock("@/lib/public-booking-policy", () => ({ resolveBookingTimeZone: vi.fn(() => "Europe/Stockholm") }));
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce(
      (result, part, index) => result + part + (index < values.length ? String(values[index]) : ""),
      "",
    );
    state.queries.push(query);

    if (query.includes("select b.id booking_id")) return state.reminderRows;
    if (query.includes("insert into booking_reminder_deliveries")) {
      const claimNumber = ++state.claimCount;
      if (state.requireConcurrentClaimOverlap) {
        state.claimInFlight += 1;
        if (state.claimInFlight === 1) {
          await new Promise<void>((resolve) => {
            state.releaseFirstClaim = resolve;
          });
        } else {
          state.claimOverlapObserved = true;
          state.releaseFirstClaim?.();
        }
        state.claimInFlight -= 1;
      }
      return claimNumber === 1 ? [{ id: "11111111-1111-4111-8111-111111111111" }] : [];
    }
    return [];
  }),
}));

import { processBookingReminders } from "@/lib/booking-reminders";

describe("booking reminder workspace join", () => {
  beforeEach(() => {
    state.queries.length = 0;
    state.reminderRows = [];
    state.claimCount = 0;
    state.claimInFlight = 0;
    state.claimOverlapObserved = false;
    state.requireConcurrentClaimOverlap = false;
    state.releaseFirstClaim = undefined;
    vi.clearAllMocks();
    mocks.sendBookingReminderEmail.mockResolvedValue({ ok: true, providerId: "email-provider-id" });
    mocks.sendBookingReminderSms.mockResolvedValue({ ok: true, providerId: "sms-provider-id" });
  });

  it("executes a UUID-safe workspace join for legacy text booking workspace ids", async () => {
    const result = await processBookingReminders();
    const reminderQuery = state.queries.find((query) => query.includes("select b.id booking_id"));

    expect(result).toEqual({ checked: 0, sent: 0, skipped: 0, failed: 0, autoCompleted: 0 });
    expect(reminderQuery).toContain("left join workspaces w on w.id::text=b.workspace_id");
    expect(reminderQuery).not.toContain("left join workspaces w on w.id=b.workspace_id");
  });

  it("claims an eligible reminder once across concurrent overlapping runs", async () => {
    state.reminderRows = [{
      booking_id: "22222222-2222-4222-8222-222222222222",
      workspace_id: "33333333-3333-4333-8333-333333333333",
      customer_id: "44444444-4444-4444-8444-444444444444",
      workspace_name: "Testföretag",
      customer_name: "Test Kund",
      customer_email: "customer@example.com",
      customer_phone: "",
      service: "Hemstädning",
      city: "Södertälje",
      starts_at: "2026-09-07T12:00:00.000Z",
      time_zone: "Europe/Stockholm",
      hours_before: 24,
      email_enabled: true,
      sms_enabled: false,
    }];
    state.requireConcurrentClaimOverlap = true;

    const [first, second] = await Promise.all([
      processBookingReminders(),
      processBookingReminders(),
    ]);

    expect(state.claimOverlapObserved).toBe(true);
    expect(state.claimCount).toBe(2);
    expect(first).toMatchObject({ checked: 1, sent: 1, skipped: 0, failed: 0 });
    expect(second).toMatchObject({ checked: 1, sent: 0, skipped: 1, failed: 0 });
    expect(mocks.sendBookingReminderEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendBookingReminderSms).not.toHaveBeenCalled();

    const claimQueries = state.queries.filter((query) => query.includes("insert into booking_reminder_deliveries"));
    expect(claimQueries).toHaveLength(2);
    expect(claimQueries[0]).toContain("on conflict do nothing returning id");
    expect(claimQueries[1]).toContain("on conflict do nothing returning id");
  });
});
