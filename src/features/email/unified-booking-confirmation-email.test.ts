import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildUnifiedBookingConfirmationEmail, sendUnifiedBookingConfirmationEmail } from "./unified-booking-confirmation-email";

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
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "dedicated-qa-only");
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

  it("permits a real Maria receipt only with every Production flag and canonical customer links", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ messageId: "production-synthetic" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const productionBooking = {
      ...booking,
      customerEmail: "customer@example.com",
      portalUrl: "https://makeupbymaria.se/mina-bokningar/example",
      rescheduleUrl: "https://makeupbymaria.se/mina-bokningar/example/booking/boka-om",
    };
    expect((await sendUnifiedBookingConfirmationEmail(productionBooking)).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await sendUnifiedBookingConfirmationEmail({
      ...productionBooking, portalUrl: "https://attacker.example/mina-bokningar/example",
    })).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "false");
    expect((await sendUnifiedBookingConfirmationEmail(productionBooking)).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

describe("Booking confirmation language consistency", () => {
  it("uses English copy and date formatting for Arabic without Maria branding", () => {
    const message = buildUnifiedBookingConfirmationEmail({
      ...booking, branding: undefined, companyName: "Other synthetic company", language: "ar",
    });
    expect(message.subject).toContain("Booking request received");
    expect(message.text).toContain("Hello QA Maria");
    expect(message.text).toContain("Start:");
    expect(message.html).not.toContain('dir="rtl"');
    expect(message.text).not.toContain("Bokningsförfrågan");
    expect(message.html).not.toContain("primeview-window-care-logo.jpeg");
    expect(message.html).not.toContain("PrimeView will confirm");
    expect(message.html).not.toContain("PrimeView Window Care · Powered by Proffera");
    expect(message.html).toContain("Other synthetic company will confirm");
    expect(message.html).toContain("Other synthetic company · Powered by Proffera");
  });

  it("escapes unbranded tenant identity in English email HTML", () => {
    const message = buildUnifiedBookingConfirmationEmail({
      ...booking, branding: undefined, companyName: 'Other & <company>', language: "en",
    });
    expect(message.html).not.toContain("primeview-window-care-logo.jpeg");
    expect(message.html).not.toContain("PrimeView will confirm");
    expect(message.html).toContain("Other &amp; &lt;company&gt; will confirm");
    expect(message.html).toContain("Other &amp; &lt;company&gt; · Powered by Proffera");
    expect(message.html).not.toContain("Other & <company>");
  });

  it("preserves PrimeView branding only for the PrimeView tenant", () => {
    const message = buildUnifiedBookingConfirmationEmail({
      ...booking, branding: undefined, companyName: "PrimeView Window Care", language: "en",
    });
    expect(message.html).toContain("primeview-window-care-logo.jpeg");
    expect(message.html).toContain("PrimeView will confirm the appointment separately.");
    expect(message.html).toContain("PrimeView Window Care · Powered by Proffera");
  });

  it("preserves Arabic copy and RTL markup for Maria", () => {
    const message = buildUnifiedBookingConfirmationEmail({ ...booking, language: "ar" });
    expect(message.text).toContain("مرحبًا QA Maria");
    expect(message.html).toContain('dir="rtl"');
  });

  it("preserves Swedish fallback for unbranded bookings without a language", () => {
    const message = buildUnifiedBookingConfirmationEmail({
      ...booking, branding: undefined, companyName: "Other synthetic company",
    });
    expect(message.subject).toContain("Bokningsförfrågan mottagen");
  });
});
