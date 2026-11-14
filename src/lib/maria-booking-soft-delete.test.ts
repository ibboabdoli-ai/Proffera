import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryText: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  getSql: () => Object.assign(
    (parts: TemplateStringsArray, ...values: unknown[]) => {
      const text = parts.reduce((s, part, index) =>
        s + part + (index < values.length ? String(values[index]) : ""), "");
      mock.queryText.push(text);
      return { text };
    },
    { transaction: mock.transaction },
  ),
}));
import { changeMariaBookingSoftDelete } from "./maria-booking-soft-delete";

const base = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  bookingId: "33333333-3333-4333-8333-333333333333",
  actorId: "synthetic-owner",
};

describe("Maria reversible archive workspace lock order", () => {
  beforeEach(() => {
    mock.transaction.mockReset();
    mock.queryText.length = 0;
  });

  it("holds advisory lock 713 before evaluating terminal archive eligibility", async () => {
    mock.transaction.mockResolvedValue([[], [{ count: 1 }]]);
    expect(await changeMariaBookingSoftDelete({ ...base, action: "hide" })).toBe("updated");
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    const queries = mock.transaction.mock.calls[0]?.[0] as Array<{ text: string }>;
    expect(queries).toHaveLength(2);
    expect(queries[0]?.text).toContain("pg_advisory_xact_lock");
    expect(queries[0]?.text).toContain(", 713)");
    expect(queries[1]?.text).toContain("b.status in ('cancelled','completed','no_show')");
    expect(queries[1]?.text).toContain("booking_soft_delete_events");
  });

  it("serializes restoration without changing payment or booking data", async () => {
    mock.transaction.mockResolvedValue([[], [{ count: 1 }]]);
    expect(await changeMariaBookingSoftDelete({ ...base, action: "restore" })).toBe("updated");
    const queries = mock.transaction.mock.calls[0]?.[0] as Array<{ text: string }>;
    expect(queries[0]?.text).toContain("pg_advisory_xact_lock");
    expect(queries[1]?.text).toContain("booking_soft_deletions");
    expect(queries[1]?.text).toContain("booking_soft_delete_events");
    expect(queries[1]?.text.toLowerCase()).not.toContain("delete from bookings");
  });

  it("does not claim a change when the transaction finds no eligible booking", async () => {
    mock.transaction.mockResolvedValue([[], [{ count: 0 }]]);
    expect(await changeMariaBookingSoftDelete({ ...base, action: "hide" })).toBe("unchanged");
  });
});
