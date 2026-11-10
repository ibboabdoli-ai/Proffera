import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readiness: vi.fn(),
  recipient: vi.fn(),
  origin: vi.fn(),
  getSql: vi.fn(),
  sendOtp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/maria-booking-runtime", () => ({ getMariaBookingReadiness: mocks.readiness }));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  isMariaBookingRecipientAllowed: mocks.recipient,
  isMariaPreviewTestRecipient: vi.fn(),
  getMariaBookingPortalBase: mocks.origin,
}));
vi.mock("@/features/email/booking-verification-email", () => ({
  sendBookingVerificationEmail: mocks.sendOtp,
}));
vi.mock("@/features/email/unified-booking-confirmation-email", () => ({
  sendUnifiedBookingConfirmationEmail: vi.fn(),
}));
vi.mock("@/features/email/lead-email", () => ({ sendBookingOwnerNotificationEmail: vi.fn() }));
vi.mock("@/features/sms/booking-sms", () => ({
  sendBookingOwnerSms: vi.fn(), sendBookingVerificationSms: vi.fn(),
}));
vi.mock("@/lib/customer-calendar", () => ({ createCustomerCalendarToken: vi.fn() }));

import { beginBookingEmailVerification } from "./public-booking-verification";

const workspaceId = "11111111-2222-4333-8444-555555555555";
const input = {
  workspaceId, slug: "makeup-by-maria", companyName: "Makeup by Maria",
  ownerEmail: "maria@example.invalid", customerName: "Synthetic Bride",
  customerEmail: "bride@example.invalid",
  serviceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  serviceName: "Brudmakeup med prov", startsAt: "2027-06-18T08:00:00Z",
  endsAt: "2027-06-18T11:00:00Z", timeZone: "Europe/Stockholm" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.readiness.mockResolvedValue({ enabled: false });
  mocks.recipient.mockReturnValue(true);
  mocks.origin.mockReturnValue("https://makeupbymaria.se");
  mocks.getSql.mockReturnValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Maria OTP issuance cannot bypass branded Production readiness via a generic caller", () => {
  it("does not touch the database or mail provider when lifecycle readiness is disabled", async () => {
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false, error:"invalid" });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.sendOtp).not.toHaveBeenCalled();
  });

  it("rejects wrong workspace, wrong slug contract, or unapproved recipient", async () => {
    mocks.readiness.mockResolvedValue({ enabled:true, workspaceId:"another-tenant", publicSlug:"makeup-by-maria" });
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false });
    mocks.readiness.mockResolvedValue({ enabled:true, workspaceId, publicSlug:"other-slug" });
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false });
    mocks.readiness.mockResolvedValue({ enabled:true, workspaceId, publicSlug:"makeup-by-maria" });
    mocks.recipient.mockReturnValue(false);
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("rejects staff allocations and SMS, even when Production is otherwise ready", async () => {
    mocks.readiness.mockResolvedValue({ enabled:true, workspaceId, publicSlug:"makeup-by-maria" });
    expect(await beginBookingEmailVerification({ ...input, verificationSms:true })).toMatchObject({ ok:false });
    expect(await beginBookingEmailVerification({ ...input, staffId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })).toMatchObject({ ok:false });
    mocks.origin.mockReturnValue(null);
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("refuses a renamed Maria public slug before using generic OTP hold SQL", async () => {
    const sql = vi.fn().mockResolvedValue([{ id: input.serviceId, workspace_slug: "makeup-by-maria" }]);
    mocks.getSql.mockReturnValue(sql);
    expect(await beginBookingEmailVerification({ ...input, slug: "renamed-maria" }))
      .toMatchObject({ ok: false, error: "invalid" });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(mocks.sendOtp).not.toHaveBeenCalled();
  });

  it("reaches the ordinary DB preflight only after all Maria issuance checks pass", async () => {
    mocks.readiness.mockResolvedValue({ enabled:true, workspaceId, publicSlug:"makeup-by-maria" });
    expect(await beginBookingEmailVerification(input)).toMatchObject({ ok:false, error:"database" });
    expect(mocks.getSql).toHaveBeenCalledOnce();
    expect(mocks.sendOtp).not.toHaveBeenCalled();
  });
});
