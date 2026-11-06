import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendUnifiedBookingConfirmationEmail } from "./unified-booking-confirmation-email";

const booking = {
  customerName: "QA Maria",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  service: "Brudsmink",
  startsAt: "2026-11-06T05:00:00.000Z",
  endsAt: "2026-11-06T08:00:00.000Z",
  city: "Södertälje",
  portalUrl: "https://qa.vercel.app/mina-bokningar/synthetic",
  rescheduleUrl: "https://qa.vercel.app/mina-bokningar/synthetic/booking/boka-om",
  branding: "makeup-by-maria" as const,
};

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "fake-test-key");
  vi.stubEnv("LEAD_FROM_EMAIL", "noreply@example.invalid");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unified email Maria Preview recipient boundary", () => {
  it("sends exactly once to the approved Maria Preview inbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ messageId: "qa-mail" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendUnifiedBookingConfirmationEmail(booking);
    expect(result).toEqual({ ok: true, providerId: "qa-mail" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as {
      to: Array<{ email: string }>;
      htmlContent: string;
    };
    expect(payload.to).toEqual([{ email: "qa@example.invalid", name: "QA Maria" }]);
    expect(payload.htmlContent).toContain("/demo/makeup-by-maria/assets/maria-client-logo.jpg");
  });

  it("does not send to an unauthorized Maria Preview customer", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendUnifiedBookingConfirmationEmail({
      ...booking, customerEmail: "another@example.invalid",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Maria Preview recipient not approved.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed outside Preview even when not in Production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_ENV", "development");
    const result = await sendUnifiedBookingConfirmationEmail(booking);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Maria Preview recipient not approved.");
    expect(fetchMock).not.toHaveBeenCalled();
  });


  it("fails closed without contacting Brevo on Production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await sendUnifiedBookingConfirmationEmail(booking)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed if the approved QA inbox changes or is removed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "another@example.invalid");
    expect((await sendUnifiedBookingConfirmationEmail(booking)).ok).toBe(false);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "");
    expect((await sendUnifiedBookingConfirmationEmail(booking)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps ordinary non-Maria tenant delivery working in Production", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: "synthetic" }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_ENV", "production");
    const result = await sendUnifiedBookingConfirmationEmail({
      ...booking, branding: undefined, companyName: "Synthetic other tenant",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
