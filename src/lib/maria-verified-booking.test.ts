import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  readiness: vi.fn(),
  sql: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/maria-booking-runtime", () => ({
  getMariaBookingReadiness: mocks.readiness,
}));

import { finalizeMariaVerifiedBooking, createMariaUnverifiedBookingRequest } from "./maria-verified-booking";

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
    expect(eligibility.sql).toContain("maria_booking_reference_counters");
    expect(eligibility.sql).toContain("maria_booking_references");
    expect(eligibility.sql).toContain("on conflict (day_key) do update");
    expect(eligibility.sql).toContain("join assigned_reference ref");
    expect(eligibility.sql).toContain("'MBM-'");
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

  it("does not reuse the Preview-only QA recipient in gated Production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "");
    const result = await finalizeMariaVerifiedBooking(input);
    expect(result.ok).toBe(true);
    const [statements] = mocks.transaction.mock.calls[0] as
      [{ sql: string; values: unknown[] }[]];
    expect(statements[1]!.sql).toContain("lower(trim(v.customer_email))=?");
    // Production conditions omit the QA-recipient restriction, but the real
    // runtime gate still denies activation until OTP and manager flows exist.
    expect(statements[1]!.values).toContain(true);
    expect(statements[1]!.values).not.toContain("qa@example.invalid");
  });

  it("rejects Production when runtime booking readiness is false", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    mocks.readiness.mockResolvedValue({ enabled: false });
    expect(await finalizeMariaVerifiedBooking(input)).toEqual({ ok: false, error: "unavailable" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not commit a booking when eligibility fails", async () => {
    mocks.transaction.mockResolvedValueOnce([[], []]);
    expect(await finalizeMariaVerifiedBooking(input)).toEqual({
      ok: false, error: "conflict",
    });
  });
});

const noOtpInput = {
  workspaceId,
  serviceId: "00000000-0000-4000-8000-000000000010",
  customerName: "QA Customer",
  customerEmail: "qa@example.invalid",
  customerPhone: "0701234567",
  city: "Södertälje",
  startsAt: "2026-12-05T09:00:00.000Z",
  endsAt: "2026-12-05T11:00:00.000Z",
  bookingNote: "Email not verified: temporary no-OTP",
  bookingLanguage: "sv" as const,
};

function enableNoOtpProduction() {
  for (const [key, value] of Object.entries({
    VERCEL_ENV: "production",
    PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
    PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "true",
    PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
    PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
    PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED: "true",
    PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
    PROFFERA_MARIA_TEMPORARY_NO_OTP_ENABLED: "true",
  })) vi.stubEnv(key, value);
}

describe("Maria temporary no-OTP bookings", () => {
  it("is disabled by default, including Preview with the flag set", async () => {
    expect(await createMariaUnverifiedBookingRequest(noOtpInput)).toEqual({
      ok: false, error: "unavailable",
    });
    vi.stubEnv("PROFFERA_MARIA_TEMPORARY_NO_OTP_ENABLED", "true");
    expect(await createMariaUnverifiedBookingRequest(noOtpInput)).toEqual({
      ok: false, error: "unavailable",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not enter the transaction if Maria runtime readiness is revoked", async () => {
    enableNoOtpProduction();
    mocks.readiness.mockResolvedValue({ enabled: false });
    expect(await createMariaUnverifiedBookingRequest(noOtpInput)).toEqual({
      ok: false, error: "unavailable",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("locks the workspace, keeps request status and audits unverified identity", async () => {
    enableNoOtpProduction();
    const result = await createMariaUnverifiedBookingRequest(noOtpInput);
    expect(result.ok).toBe(true);
    const [statements] = mocks.transaction.mock.calls[0] as
      [{ sql: string; values: unknown[] }[]];
    expect(statements).toHaveLength(2);
    expect(statements[0]!.sql).toContain("pg_advisory_xact_lock");
    const insert = statements[1]!;
    expect(insert.sql).toContain("'requested'");
    expect(insert.sql).not.toContain("'confirmed'");
    expect(insert.sql).toContain("'email_verified',false");
    expect(insert.sql).toContain("'temporary_no_otp'");
    expect(insert.sql).toContain("maria_manual_closed_starts");
    expect(insert.sql).toContain("public_booking_verifications hold");
    expect(insert.sql).toContain("not exists (");
    expect(insert.sql).toContain("maria_booking_reference_counters");
    expect(insert.sql).toContain("maria_booking_references");
    expect(insert.sql).toContain("join audit a on true");
    expect(insert.sql).not.toContain("set verified_at");
    expect(insert.values).toContain(noOtpInput.customerEmail);
    expect(insert.values).toContain(noOtpInput.startsAt);
  });

  it("does not create a booking when the atomic availability check fails", async () => {
    enableNoOtpProduction();
    mocks.transaction.mockResolvedValueOnce([[], []]);
    expect(await createMariaUnverifiedBookingRequest(noOtpInput)).toEqual({
      ok: false, error: "conflict",
    });
  });
});
