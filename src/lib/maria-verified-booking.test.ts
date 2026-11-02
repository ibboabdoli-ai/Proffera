import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  readiness: vi.fn(),
  sql: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: mocks.readiness,
}));

import { finalizeMariaVerifiedBooking } from "./maria-verified-booking";

const workspaceId = "19fecc58-08ba-406e-b3b7-090df9401cf7";
const input = {
  verificationId: "00000000-0000-0000-0000-000000000001",
  expectedCodeHash: "qa-code-hash",
  bookingNote: "QA",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  mocks.readiness.mockResolvedValue({ enabled: true, workspaceId });
  mocks.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({
    sql: parts.join("?"), values,
  }));
  mocks.getSql.mockReturnValue(Object.assign(mocks.sql, { transaction: mocks.transaction }));
  mocks.transaction.mockResolvedValue([[], [{
    booking_id: "00000000-0000-0000-0000-000000000002",
    customer_id: "00000000-0000-0000-0000-000000000003",
  }]]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Maria verified booking keeps the current Preview recipient boundary", () => {
  it("refuses to enter the booking transaction after the QA inbox is removed", async () => {
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "");
    expect(await finalizeMariaVerifiedBooking(input)).toEqual({
      ok: false, error: "invalid",
    });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("binds the current QA email in the atomic eligibility query", async () => {
    const result = await finalizeMariaVerifiedBooking(input);
    expect(result).toEqual({
      ok: true,
      bookingId: "00000000-0000-0000-0000-000000000002",
      customerId: "00000000-0000-0000-0000-000000000003",
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const [statements] = mocks.transaction.mock.calls[0] as
      [{ sql: string; values: unknown[] }[]];
    expect(statements).toHaveLength(2);
    expect(statements[0]!.sql).toContain("pg_advisory_xact_lock");
    const eligibility = statements[1]!;
    expect(eligibility.sql).toContain("lower(trim(v.customer_email))=?");
    expect(eligibility.values).toContain("qa@example.invalid");
    expect(eligibility.values).toContain(input.verificationId);
    expect(eligibility.values).toContain(input.expectedCodeHash);
  });

  it("requires the new inbox when the environment has changed", async () => {
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "new-qa@example.invalid");
    // The canonical DB eligibility predicate returns no booking when the
    // stored challenge remains on the formerly approved address.
    mocks.transaction.mockResolvedValueOnce([[], []]);
    expect(await finalizeMariaVerifiedBooking(input)).toEqual({
      ok: false, error: "conflict",
    });
    const [statements] = mocks.transaction.mock.calls[0] as
      [{ sql: string; values: unknown[] }[]];
    expect(statements[1]!.sql).toContain("lower(trim(v.customer_email))=?");
    expect(statements[1]!.values).toContain("new-qa@example.invalid");
    expect(statements[1]!.values).not.toContain("qa@example.invalid");
  });

  it("does not commit a booking when eligibility fails", async () => {
    mocks.transaction.mockResolvedValueOnce([[], []]);
    expect(await finalizeMariaVerifiedBooking(input)).toEqual({
      ok: false, error: "conflict",
    });
  });
});
