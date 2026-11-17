import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendBookingVerificationEmail } from "./booking-verification-email";

type EmailPayload = {
  htmlContent: string;
  textContent: string;
  subject: string;
  sender: { email: string };
  replyTo: { email: string };
};
const fixture = {
  customerName: "QA Client",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  code: "123456",
  language: "sv" as const,
};
let sent: EmailPayload[];

beforeEach(() => {
  sent = [];
  vi.stubEnv("BREVO_API_KEY", "fake-test-key");
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "dedicated-qa-only");
  vi.stubEnv("BOOKING_FROM_EMAIL", "Proffera Booking <booking@proffera.se>");
  vi.stubEnv("BOOKING_REPLY_TO_EMAIL", "Proffera <info@proffera.se>");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    sent.push(JSON.parse(String(options.body)) as EmailPayload);
    return { ok: true, json: async () => ({ messageId: "fake-test-id" }) };
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria verification email branding isolation", () => {
  it("does not brand another workspace solely because its company name matches", async () => {
    expect((await sendBookingVerificationEmail(fixture)).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.htmlContent).not.toContain("maria-client-logo.jpg");
    expect(sent[0]!.htmlContent).toContain("Makeup by Maria");
  });

  it("brands explicit Maria mail in Preview but never in Production", async () => {
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[0]!.htmlContent).toContain(
      "https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg",
    );
    expect(sent[0]!.textContent).toContain("123456");
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[1]!.htmlContent).not.toContain("maria-client-logo.jpg");
  });

  it("keeps Maria's HTML and logo in Production, even with the retired text flag", async () => {
    vi.stubEnv("MARIA_BOOKING_OTP_TEXT_ONLY", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[0]!.htmlContent).toContain("https://makeupbymaria.se/demo/makeup-by-maria/assets/maria-client-logo.jpg");
    expect(sent[0]!.htmlContent).toContain("Verifieringskod");
    expect(sent[0]!.textContent).toContain("123456");
    expect(sent[0]!.sender.email).toBe("booking@proffera.se");
    expect(sent[0]!.replyTo.email).toBe("info@proffera.se");

    expect((await sendBookingVerificationEmail(fixture)).ok).toBe(true);
    expect(sent[1]!.htmlContent).toContain("Verifieringskod");
    expect(sent[1]!.htmlContent).not.toContain("maria-client-logo.jpg");

    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[2]!.htmlContent).toContain("maria-client-logo.jpg");
  });

  it.each(["untrusted.example", "qa.vercel.app:444", "qa.vercel.app/other"])(
    "omits Maria verification logo for an invalid Preview host %s",
    async (host) => {
      vi.stubEnv("VERCEL_URL", host);
      expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
      expect(sent).toHaveLength(1);
      expect(sent[0]!.htmlContent).not.toContain("maria-client-logo.jpg");
    },
  );

  it("uses the explicit Maria flag even with a renamed display name and Arabic RTL", async () => {
    expect((await sendBookingVerificationEmail({
      ...fixture, companyName: "Maria Studio", branding: "makeup-by-maria", language: "ar",
    })).ok).toBe(true);
    expect(sent[0]!.htmlContent).toContain("maria-client-logo.jpg");
    expect(sent[0]!.htmlContent).toContain('dir="rtl"');
    expect(sent[0]!.subject).toContain("Maria Studio");
    expect(sent[0]!.textContent).toContain("لن يتم إنشاء الحجز إلا بعد التحقق من الرمز.");
  });

  it.each([413, 422, 429])("identifies HTTP %i as a definitive provider rejection", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status, json: async () => ({ message: "rejected" }),
    })));
    expect(await sendBookingVerificationEmail(fixture)).toEqual({
      ok: false, message: "rejected", deliveryOutcome: "not_sent",
    });
  });

  it("treats a 503 or lost provider response as uncertain delivery", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 503, json: async () => ({ message: "unavailable" }),
    })));
    expect(await sendBookingVerificationEmail(fixture)).toEqual({
      ok: false, message: "unavailable", deliveryOutcome: "uncertain",
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("response lost"); }));
    expect(await sendBookingVerificationEmail(fixture)).toEqual({
      ok: false, message: "Email delivery failed.", deliveryOutcome: "uncertain",
    });
  });
});


describe("optional Maria Resend verification provider", () => {
  it("uses Resend only for Maria in Production after an explicit opt-in", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "qa-resend-key");
    const request = vi.fn(async (_url: string, _options: RequestInit) => ({
      ok: true, json: async () => ({ id: "resend-test-id" }),
    }));
    vi.stubGlobal("fetch", request);

    expect(await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).toEqual({
      ok: true, providerId: "resend-test-id",
    });
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({ Authorization: "Bearer qa-resend-key" });
    const body = JSON.parse(String(options.body));
    expect(body.from).toBe("Proffera Booking <booking@proffera.se>");
    expect(body.to).toEqual(["qa@example.invalid"]);
    expect(body.reply_to).toBe("info@proffera.se");
    expect(body.html).toContain("123456");
    expect(body.text).toContain("123456");
    expect(body).not.toHaveProperty("htmlContent");
  });

  it("keeps other workspaces on Brevo even when Maria uses Resend", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "qa-resend-key");
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: "brevo-test-id" }) }));
    vi.stubGlobal("fetch", request);
    expect((await sendBookingVerificationEmail(fixture)).ok).toBe(true);
    expect(request.mock.calls[0]![0]).toBe("https://api.brevo.com/v3/smtp/email");
  });

  it("keeps Preview on isolated Brevo credentials even if Resend is selected", async () => {
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "qa-resend-key");
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: "preview-test-id" }) }));
    vi.stubGlobal("fetch", request);
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(request.mock.calls[0]![0]).toBe("https://api.brevo.com/v3/smtp/email");
    expect(request.mock.calls[0]![1].headers).toMatchObject({ "api-key": "dedicated-qa-only" });
  });

  it("does not fall back or send when the selected Resend key is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).toEqual({
      ok: false, message: "Email provider is not configured.", deliveryOutcome: "not_sent",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 422, 429])("classifies Resend HTTP %i as definitely not sent", async (status) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "qa-resend-key");
    const request = vi.fn(async () => ({ ok: false, status, json: async () => ({ message: "rejected" }) }));
    vi.stubGlobal("fetch", request);
    expect(await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).toEqual({
      ok: false, message: "Email delivery failed.", deliveryOutcome: "not_sent",
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("preserves uncertain Resend outcomes without triggering Brevo fallback", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MARIA_BOOKING_OTP_PROVIDER", "resend");
    vi.stubEnv("MARIA_RESEND_API_KEY", "qa-resend-key");
    const request = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ message: "unavailable" }) }));
    vi.stubGlobal("fetch", request);
    expect(await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).toEqual({
      ok: false, message: "Email delivery failed.", deliveryOutcome: "uncertain",
    });
    expect(request).toHaveBeenCalledOnce();
    const lostResponse = vi.fn(async () => { throw new Error("lost response"); });
    vi.stubGlobal("fetch", lostResponse);
    expect(await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).toEqual({
      ok: false, message: "Email delivery failed.", deliveryOutcome: "uncertain",
    });
    expect(lostResponse).toHaveBeenCalledOnce();
  });
});
