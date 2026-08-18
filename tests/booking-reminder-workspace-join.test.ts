import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ queries: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({ resolveDatabaseUrl: () => "postgres://test" }));
vi.mock("@/features/email/booking-reminder-email", () => ({ sendBookingReminderEmail: vi.fn() }));
vi.mock("@/features/sms/booking-reminder-sms", () => ({ sendBookingReminderSms: vi.fn() }));
vi.mock("@/lib/customer-calendar", () => ({ createCustomerCalendarToken: vi.fn(() => "token") }));
vi.mock("@/lib/public-booking-policy", () => ({ resolveBookingTimeZone: vi.fn(() => "Europe/Stockholm") }));
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.reduce(
      (result, part, index) => result + part + (index < values.length ? String(values[index]) : ""),
      "",
    );
    state.queries.push(query);
    return [];
  }),
}));

import { processBookingReminders } from "@/lib/booking-reminders";

describe("booking reminder workspace join", () => {
  beforeEach(() => {
    state.queries.length = 0;
  });

  it("executes a UUID-safe workspace join for legacy text booking workspace ids", async () => {
    const result = await processBookingReminders();
    const reminderQuery = state.queries.find((query) => query.includes("select b.id booking_id"));

    expect(result).toEqual({ checked: 0, sent: 0, skipped: 0, failed: 0, autoCompleted: 0 });
    expect(reminderQuery).toContain("left join workspaces w on w.id::text=b.workspace_id");
    expect(reminderQuery).not.toContain("left join workspaces w on w.id=b.workspace_id");
  });
});
