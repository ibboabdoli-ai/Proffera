import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingChangeEmails } from "./booking-change-email";
import { sendBookingVerificationEmail } from "./booking-verification-email";

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "qa-mocked-key");
  vi.stubEnv("LEAD_FROM_EMAIL", "Proffera QA <booking@example.invalid>");
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ messageId: "qa-mocked" }),
  })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria-only Arabic customer notifications", () => {
  it("sends an RTL Arabic email verification code without real provider egress", async () => {
    const result = await sendBookingVerificationEmail({
      customerName: "QA Test", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", code: "123456",
      language: "ar",
    });
    expect(result.ok).toBe(true);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(options?.body)) as {
      subject: string; htmlContent: string; textContent: string;
    };
    expect(payload.subject).toContain("رمز التحقق");
    expect(payload.htmlContent).toContain('dir="rtl"');
    expect(payload.textContent).toContain("Makeup by Maria");
  });

  it("sends RTL Arabic reschedule email with private Preview management link", async () => {
    const result = await sendBookingChangeEmails({
      kind: "rescheduled", customerName: "QA Test",
      customerEmail: "qa@example.invalid", companyName: "Makeup by Maria",
      service: "Brudsmink", city: "QA City",
      oldStartsAt: "2026-12-12T06:00:00.000Z",
      oldEndsAt: "2026-12-12T09:00:00.000Z",
      newStartsAt: "2026-12-12T09:00:00.000Z",
      newEndsAt: "2026-12-12T12:00:00.000Z",
      portalUrl: "https://qa-example.vercel.app/mina-bokningar/example?lang=ar",
      timeZone: "Europe/Stockholm", language: "ar",
    });
    expect(result).toHaveLength(1);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(options?.body)) as {
      subject: string; htmlContent: string; textContent: string;
    };
    expect(payload.subject).toContain("تم تغيير");
    expect(payload.htmlContent).toContain('dir="rtl"');
    expect(payload.htmlContent).toContain("lang=ar");
    expect(payload.htmlContent.toLowerCase()).not.toContain("primeview");
  });
});
