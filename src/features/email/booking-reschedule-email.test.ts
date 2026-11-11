import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const guards = vi.hoisted(() => ({
  portal: vi.fn((): string | null => "https://maria-qa.vercel.app"),
  existingPortal: vi.fn((): string | null => "https://makeupbymaria.se"),
  allowed: vi.fn(() => true),
  existingAllowed: vi.fn(() => true),
  existingLifecycle: vi.fn(() => false),
  readiness: vi.fn(async () => ({ enabled: true })),
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  getMariaBookingPortalBase: guards.portal,
  getMariaExistingBookingPortalBase: guards.existingPortal,
  isMariaBookingRecipientAllowed: guards.allowed,
  isMariaExistingBookingRecipientAllowed: guards.existingAllowed,
}));
vi.mock("@/lib/maria-production-activation-policy", () => ({
  isMariaProductionExistingBookingLifecycleAuthorized: guards.existingLifecycle,
}));
vi.mock("@/lib/maria-booking-runtime", () => ({
  getMariaBookingReadiness: guards.readiness,
}));
import { sendBookingRescheduleEmail } from "./booking-reschedule-email";

const booking = {
  customerName: "Synthetic customer",
  customerEmail: "qa@example.invalid",
  companyName: "Synthetic company",
  service: "Synthetic appointment",
  previousStartsAt: "2027-06-18T08:00:00.000Z",
  startsAt: "2027-06-25T08:00:00.000Z",
  endsAt: "2027-06-25T11:00:00.000Z",
  city: "Södertälje",
  timeZone: "Europe/Stockholm" as const,
};
beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("BREVO_API_KEY", "synthetic-only-key");
  vi.stubEnv("LEAD_FROM_EMAIL", "Synthetic <sender@example.invalid>");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bounded booking reschedule email delivery", () => {
  it("marks Maria portal, recipient, and readiness pre-dispatch failures as definitely unsent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onRequestStart = vi.fn();
    const input = { ...booking, branding: "makeup-by-maria" as const, onRequestStart };

    guards.portal.mockReturnValueOnce(null);
    expect(await sendBookingRescheduleEmail(input)).toEqual({
      ok: false, notSent: true, message: "Maria booking recipient is not allowed.",
    });
    guards.allowed.mockReturnValueOnce(false);
    expect(await sendBookingRescheduleEmail(input)).toEqual({
      ok: false, notSent: true, message: "Maria booking recipient is not allowed.",
    });
    guards.readiness.mockResolvedValueOnce({ enabled: false });
    expect(await sendBookingRescheduleEmail(input)).toEqual({
      ok: false, notSent: true, message: "Maria booking is not ready.",
    });
    expect(onRequestStart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an authorized manager's existing reschedule notice without new-intake entitlement", async () => {
    vi.clearAllMocks();
    guards.existingLifecycle.mockReturnValue(true);
    guards.readiness.mockResolvedValue({ enabled:false });
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:201,json:async()=>({messageId:"synthetic-existing"}),
    });
    vi.stubGlobal("fetch",fetchMock);
    const result=await sendBookingRescheduleEmail({
      ...booking,branding:"makeup-by-maria",allowExistingLifecycle:true,
    });
    expect(result).toEqual({ok:true,providerId:"synthetic-existing"});
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(guards.readiness).not.toHaveBeenCalled();
    expect(guards.existingAllowed).toHaveBeenCalledWith("qa@example.invalid");
  });

  it("refuses the existing-manager exception without independent Production authorization", async () => {
    vi.clearAllMocks();
    guards.existingLifecycle.mockReturnValue(false);
    guards.readiness.mockResolvedValue({enabled:false});
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    expect(await sendBookingRescheduleEmail({
      ...booking,branding:"makeup-by-maria",allowExistingLifecycle:true,
    })).toMatchObject({ok:false,notSent:true});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds a provider wait and labels a timeout as uncertain delivery", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Synthetic timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendBookingRescheduleEmail(booking)).toMatchObject({
      ok: false,
      deliveryUncertain: true,
      message: "Brevo request timed out; email delivery is unconfirmed.",
    });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });
  it("does not report success when a 2xx response body times out", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new DOMException("Synthetic body timeout", "TimeoutError"); },
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendBookingRescheduleEmail(booking)).toEqual({
      ok: false,
      deliveryUncertain: true,
      message: "Brevo response body could not be read; email delivery is unconfirmed.",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("treats definite Brevo permission rejection as unsent and retryable after fixing permissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok:false,status:403,
      json:async()=>({message:"Synthetic Brevo permission denied"}),
    });
    vi.stubGlobal("fetch",fetchMock);
    expect(await sendBookingRescheduleEmail(booking)).toEqual({
      ok:false,notSent:true,message:"Synthetic Brevo permission denied",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps missing Brevo configuration safely retryable in Preview before HTTP starts", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", undefined);
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:201,json:async()=>({messageId:"synthetic-success"}),
    });
    vi.stubGlobal("fetch",fetchMock);
    let started=0;
    const input={...booking,onRequestStart:()=>{started++;}};
    expect(await sendBookingRescheduleEmail(input)).toEqual({
      ok:false,notSent:true,message:"Brevo är inte konfigurerat.",
    });
    expect(started).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();

    // Once configuration is fixed, the same safe, proven-unsent notice can
    // be explicitly retried. No production or real network egress is involved.
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "synthetic-preview-only-key");
    expect(await sendBookingRescheduleEmail(input)).toEqual({
      ok:true,providerId:"synthetic-success",
    });
    expect(started).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refuses a send after the notification deadline without calling Brevo", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendBookingRescheduleEmail({ ...booking, signal: controller.signal }))
      .toMatchObject({ ok: false, notSent: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats unknown provider rejection as unconfirmed rather than inventing non-delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ message: "Synthetic provider rejection" }),
    }));
    expect(await sendBookingRescheduleEmail(booking)).toEqual({
      ok: false, deliveryUncertain: true, message: "Synthetic provider rejection",
    });
  });
});
