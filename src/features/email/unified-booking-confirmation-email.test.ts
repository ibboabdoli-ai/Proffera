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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Unified email Maria Preview recipient boundary", () => {
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
