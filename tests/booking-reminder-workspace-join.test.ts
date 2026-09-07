import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as string[],
  reminderRows: [] as Array<Record<string, unknown>>,
  claimAttempts: [] as string[],
  claimedDeliveryKeys: new Set<string>(),
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
      const claimKey = [values[0], values[1], values[2], values[3]].map(String).join("|");
      const alreadyClaimed = state.claimedDeliveryKeys.has(claimKey);
      state.claimAttempts.push(claimKey);
      if (!alreadyClaimed) state.claimedDeliveryKeys.add(claimKey);

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
      return alreadyClaimed
        ? []
        : [{ id: `00000000-0000-4000-8000-${String(claimNumber).padStart(12, "0")}` }];
    }
    return [];
  }),
}));

import { processBookingReminders } from "@/lib/booking-reminders";

describe("booking reminder workspace join", () => {
  beforeEach(() => {
    state.queries.length = 0;
    state.reminderRows = [];
    state.claimAttempts.length = 0;
    state.claimedDeliveryKeys.clear();
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

  it("claims each delivery identity once across concurrent overlapping runs", async () => {
    state.reminderRows = [
      {
        booking_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        customer_id: "44444444-4444-4444-8444-444444444444",
        workspace_name: "Testföretag",
        customer_name: "Test Kund",
        customer_email: "customer@example.com",
        customer_phone: "+46700000001",
        service: "Hemstädning",
        city: "Södertälje",
        starts_at: "2026-09-07T12:00:00.000Z",
        time_zone: "Europe/Stockholm",
        hours_before: 24,
        email_enabled: true,
        sms_enabled: true,
      },
      {
        booking_id: "55555555-5555-4555-8555-555555555555",
        workspace_id: "66666666-6666-4666-8666-666666666666",
        customer_id: "77777777-7777-4777-8777-777777777777",
        workspace_name: "Andra Testföretaget",
        customer_name: "Andra Kunden",
        customer_email: "other@example.com",
        customer_phone: "+46700000002",
        service: "Fönsterputs",
        city: "Stockholm",
        starts_at: "2026-09-07T13:30:00.000Z",
        time_zone: "Europe/Stockholm",
        hours_before: 24,
        email_enabled: true,
        sms_enabled: true,
      },
    ];
    state.requireConcurrentClaimOverlap = true;

    const [first, second] = await Promise.all([
      processBookingReminders(),
      processBookingReminders(),
    ]);

    expect(state.claimOverlapObserved).toBe(true);
    expect(state.claimCount).toBe(8);
    expect(first.checked).toBe(2);
    expect(second.checked).toBe(2);
    expect(first.sent + second.sent).toBe(4);
    expect(first.skipped + second.skipped).toBe(4);
    expect(first.failed + second.failed).toBe(0);
    expect(mocks.sendBookingReminderEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendBookingReminderSms).toHaveBeenCalledTimes(2);

    expect(state.claimedDeliveryKeys.size).toBe(4);
    const claimAttemptCounts = new Map<string, number>();
    for (const key of state.claimAttempts) {
      claimAttemptCounts.set(key, (claimAttemptCounts.get(key) ?? 0) + 1);
    }
    expect([...claimAttemptCounts.values()]).toEqual([2, 2, 2, 2]);

    const claimedIdentities = [...state.claimedDeliveryKeys].map((key) => key.split("|"));
    expect(new Set(claimedIdentities.map(([workspaceId]) => workspaceId)).size).toBe(2);
    expect(new Set(claimedIdentities.map(([, bookingId]) => bookingId)).size).toBe(2);
    expect(new Set(claimedIdentities.map(([, , channel]) => channel))).toEqual(new Set(["email", "sms"]));
    expect(new Set(claimedIdentities.map(([, , , scheduledFor]) => scheduledFor)).size).toBe(2);

    const claimQueries = state.queries.filter((query) => query.includes("insert into booking_reminder_deliveries"));
    expect(claimQueries).toHaveLength(8);
    for (const claimQuery of claimQueries) {
      expect(claimQuery).toContain("on conflict do nothing returning id");
    }
  });
});
