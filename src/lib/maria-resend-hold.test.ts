import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  tag: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { renewMariaPreviewHoldForResend } from "./maria-resend-hold";

const params = {
  workspaceId: "19fecc58-08ba-406e-b3b7-090df9401cf7",
  verificationId: "00000000-0000-0000-0000-000000000001",
  expectedCodeHash: "not-a-real-code-hash",
  expiresAt: "2026-11-01T12:10:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  // The Neon tagged-template builder is lazy: transaction executes both
  // statements together. No real database or email provider is contacted.
  mocks.tag.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join("?"),
    values,
  }));
  const sql = Object.assign(mocks.tag, { transaction: mocks.transaction });
  mocks.getSql.mockReturnValue(sql);
  mocks.transaction.mockResolvedValue([[], [{ id: params.verificationId }]]);
});

describe("Maria Preview resend hold revalidation", () => {
  it("serializes renewal under the same workspace lock and checks bookings and other holds", async () => {
    expect(await renewMariaPreviewHoldForResend(params)).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    const [statements] = mocks.transaction.mock.calls[0] as [{ sql: string; values: unknown[] }[]];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("pg_advisory_xact_lock(hashtextextended(");
    expect(statements[0].sql).toContain(", 713)");
    expect(statements[0].values).toContain(params.workspaceId);

    const update = statements[1].sql.replace(/\\s+/g, " ");
    expect(update).toContain("update public_booking_verifications v");
    expect(update).toContain("not exists ( select 1 from bookings b");
    expect(update).toContain("not exists ( select 1 from public_booking_verifications other");
    expect(update).toContain("other.id <> v.id");
    expect(update).toContain("other.expires_at > now()");
    expect(update).toContain("s.buffer_before_minutes");
    expect(update).toContain("s.buffer_after_minutes");
    expect(update).toContain("v.ends_at = v.starts_at +");
    expect(update).toContain("s.maximum_advance_days");
    expect(update).toContain("h.is_closed = false");
    expect(update).toContain("v.consumed_at is null and v.verified_at is null");
    expect(update).toContain("v.updated_at <= now() - interval '30 seconds'");
  });

  it("rejects renewal if the slot was taken while the old hold was expired", async () => {
    // The UPDATE matched no row after rechecking overlap under the lock.
    mocks.transaction.mockResolvedValueOnce([[], []]);
    expect(await renewMariaPreviewHoldForResend(params)).toEqual({ ok: false, error: "conflict" });
  });

  it("fails closed if the database is unavailable", async () => {
    mocks.getSql.mockReturnValueOnce(null);
    expect(await renewMariaPreviewHoldForResend(params)).toEqual({ ok: false, error: "database" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("fails closed if the locked transaction errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.transaction.mockRejectedValueOnce(new Error("simulated transaction error"));
      expect(await renewMariaPreviewHoldForResend(params)).toEqual({ ok: false, error: "database" });
    } finally {
      log.mockRestore();
    }
  });
});
