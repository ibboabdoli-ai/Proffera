import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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
  it("bounds a provider wait and labels a timeout as uncertain delivery", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Synthetic timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendBookingRescheduleEmail(booking)).toMatchObject({
      ok: false,
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
      message: "Brevo response body could not be read; email delivery is unconfirmed.",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not mislabel an explicit Brevo rejection as uncertain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ message: "Synthetic provider rejection" }),
    }));
    expect(await sendBookingRescheduleEmail(booking)).toEqual({
      ok: false, message: "Synthetic provider rejection",
    });
  });
});
