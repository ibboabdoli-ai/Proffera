import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  readiness: vi.fn(),
  renew: vi.fn(),
  email: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/maria-preview-booking", () => ({ getMariaPreviewBookingReadiness: mocks.readiness }));
vi.mock("@/lib/maria-resend-hold", () => ({ renewMariaPreviewHoldForResend: mocks.renew }));
vi.mock("@/features/email/booking-verification-email", () => ({ sendBookingVerificationEmail: mocks.email }));
vi.mock("@/features/email/lead-email", () => ({ sendBookingOwnerNotificationEmail: vi.fn() }));
vi.mock("@/features/email/unified-booking-confirmation-email", () => ({ sendUnifiedBookingConfirmationEmail: vi.fn() }));
vi.mock("@/features/sms/booking-sms", () => ({ sendBookingOwnerSms: vi.fn(), sendBookingVerificationSms: vi.fn() }));
vi.mock("@/lib/customer-calendar", () => ({ createCustomerCalendarToken: vi.fn() }));
vi.mock("@/lib/maria-verified-booking", () => ({ finalizeMariaVerifiedBooking: vi.fn() }));
vi.mock("@/lib/maria-preview-customer-safety", () => ({ isMariaPreviewTestRecipient: vi.fn() }));

import { resendPublicBookingCode } from "./public-booking-verification";

const workspaceId = "19fecc58-08ba-406e-b3b7-090df9401cf7";
const verificationId = "00000000-0000-0000-0000-000000000001";
type Statement = { sql: string; values: unknown[] };
const statements: Statement[] = [];
let challenge: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  statements.length = 0;
  challenge = {
    id: verificationId,
    workspace_id: workspaceId,
    public_booking_slug: "makeup-by-maria",
    created_at: new Date(Date.now() - 120_000).toISOString(),
    updated_at: new Date(Date.now() - 60_000).toISOString(),
    customer_name: "QA Customer",
    customer_email: "qa@example.invalid",
    company_name: "Maria QA",
    customer_phone: null,
    consumed_at: null,
    verified_at: null,
  };
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.join("?");
    statements.push({ sql: statement, values });
    if (statement.includes("select v.*")) return Promise.resolve([challenge]);
    if (statement.includes("delete from public_booking_verifications")) return Promise.resolve([]);
    if (statement.includes("update public_booking_verifications")) return Promise.resolve([]);
    throw new Error("Unexpected SQL in Maria resend test");
  };
  mocks.getSql.mockReturnValue(sql);
  mocks.readiness.mockResolvedValue({ enabled: true, workspaceId });
  mocks.renew.mockResolvedValue({ ok: true });
  mocks.email.mockResolvedValue({ ok: true, providerId: "qa" });
});

const deletes = () => statements.filter((entry) => entry.sql.includes("delete from public_booking_verifications"));

describe("Maria resend: provider uncertainty must not discard a potentially delivered code", () => {
  it("keeps the renewed hold when the provider response is lost", async () => {
    mocks.email.mockResolvedValueOnce({
      ok: false, message: "Email delivery failed.", deliveryOutcome: "uncertain",
    });
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: false, error: "email" });
    expect(mocks.renew).toHaveBeenCalledTimes(1);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(deletes()).toHaveLength(0);
  });

  it("keeps the renewed hold on an ambiguous provider 5xx", async () => {
    mocks.email.mockResolvedValueOnce({ ok: false, message: "unavailable", deliveryOutcome: "uncertain" });
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: false, error: "email" });
    expect(deletes()).toHaveLength(0);
  });

  it("releases only the same unconsumed hold after a definite rejection", async () => {
    mocks.email.mockResolvedValueOnce({ ok: false, message: "rejected", deliveryOutcome: "not_sent" });
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: false, error: "email" });
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0]!.sql).toContain("code_hash = ?");
    expect(deletes()[0]!.sql).toContain("consumed_at is null and verified_at is null");
    const renewal = mocks.renew.mock.calls[0]![0] as { expectedCodeHash: string };
    expect(deletes()[0]!.values).toEqual([verificationId, workspaceId, renewal.expectedCodeHash]);
  });

  it("does not delete an accepted code", async () => {
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: true, delivery: "email" });
    expect(deletes()).toHaveLength(0);
  });

  it("does not send email or delete a hold when revalidation fails", async () => {
    mocks.renew.mockResolvedValueOnce({ ok: false, error: "conflict" });
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: false, error: "conflict" });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(deletes()).toHaveLength(0);
  });

  it("preserves generic tenant resend semantics", async () => {
    challenge.public_booking_slug = "other-business";
    expect(await resendPublicBookingCode(verificationId)).toEqual({ ok: true, delivery: "email" });
    expect(mocks.renew).not.toHaveBeenCalled();
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({
      companyName: "Maria QA", language: "sv",
    }));
    expect(deletes()).toHaveLength(0);
  });
});
